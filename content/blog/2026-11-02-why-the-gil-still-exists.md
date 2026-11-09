---
title: "Why the GIL Still Exists (And Why Python 3.13's No-GIL Mode Isn't Magic)"
date: 2026-11-02
draft: false
summary: "Reference counting, the C extension problem, and what PEP 703's free-threaded CPython build actually changes."
categories: ["personal"]
---

If you've spent more than six months writing Python for anything performance-sensitive, you've had the GIL conversation. It usually goes like this:

"Why is my multi-threaded Python program only using one core?"

"Because of the GIL."

"What's the GIL?"

"The Global Interpreter Lock. It means only one thread can execute Python bytecode at a time."

"That's... on purpose?"

"Yes."

"Why?"

And that question ("why?") leads down a rabbit hole that most people never fully explore. They stop at "Python is slow because of the GIL" and move on to Go or Rust. Yet the GIL's existence is not a bug, not an oversight, and not laziness. It's a carefully considered trade-off that makes Python what it is. And removing it is far harder than anyone outside CPython core development realizes.

## What the GIL Actually Does

The GIL is a mutex (mutual exclusion lock) that protects access to Python objects. When a thread wants to execute Python bytecode, it must acquire the GIL. When it releases the GIL (typically after executing N bytecode instructions, or when performing I/O), another thread can acquire it.

The effect: only one thread executes Python code at any given moment. Multi-threading in Python gives you concurrency (interleaved execution) but not parallelism (simultaneous execution).

"But wait," you say, "my multi-threaded web server handles concurrent requests just fine." Correct, because most web servers spend their time waiting on I/O (network, database, file system). The GIL is released during I/O operations, so threads waiting on I/O don't block each other. The GIL is only a problem for CPU-bound parallelism.

## Why the GIL Exists

Python's memory management is based on **reference counting.** Every Python object has a reference count: a number tracking how many variables, containers, or other objects point to it. When the count drops to zero, the object is immediately freed.

```python
a = [1, 2, 3]   # refcount: 1
b = a            # refcount: 2
del a            # refcount: 1
del b            # refcount: 0 -> freed immediately
```

Reference counting is simple, deterministic, and memory-efficient. Objects are freed the instant they're no longer needed, with no GC pause and no delayed cleanup. This is why Python programs have relatively predictable memory usage compared to Java or Go.

The problem: reference counting is not thread-safe. If two threads simultaneously increment and decrement the same object's reference count without synchronization, the count can become inconsistent. This leads to objects being freed while still in use (crash) or never being freed (memory leak).

The "obvious" fix is to put a lock on every object. Except Python has a *lot* of objects. Even `x = 1` creates (or reuses) an object. Per-object locking would mean acquiring and releasing a lock on every single operation: incrementing `x`, accessing a dictionary key, iterating a list. The overhead would make Python 30-40% slower for single-threaded code (this was actually measured in early experiments to remove the GIL).

The GIL is the pragmatic solution: one big lock instead of millions of small ones. Single-threaded code (which is the vast majority of Python code) pays no locking overhead. Multi-threaded CPU-bound code can't use multiple cores. The GIL chose to optimize for the common case.

## The C Extension Problem

Here's the part that makes removing the GIL truly difficult: Python's C extension API.

Python's power comes from its ecosystem: NumPy, pandas, TensorFlow, scikit-learn, Pillow, and thousands of other libraries. Many of these are written in C (or C++, Cython, or Fortran) and interface with Python through the C API.

The C API has *always assumed the GIL exists.* C extensions freely access Python objects, manipulate reference counts, and call Python API functions, all with the implicit guarantee that no other thread is simultaneously modifying those objects.

Removing the GIL means every C extension that touches Python objects is now potentially broken. Not "needs a recompile" broken. "Has race conditions that will corrupt memory" broken.

The Python ecosystem has thousands of C extensions, many maintained by small teams or individual developers. Requiring all of them to be audited and updated for thread safety is a monumental coordination problem.

## Python 3.13: The Free-Threaded Build

PEP 703, accepted in 2023 and available as an experimental option in Python 3.13 (released October 2024), introduces a **free-threaded build** of CPython, a version with the GIL disabled.

This is a genuinely impressive engineering achievement. The CPython team replaced reference counting with:

- **Biased reference counting:** Objects are "biased" toward their creating thread. The owning thread can increment/decrement the count without atomics. Other threads use atomic operations. This reduces the overhead for the common case (most objects are accessed by one thread).
- **Deferred reference counting:** For immortal objects (small integers, `None`, `True`, `False`) and interned strings, reference counting is skipped entirely.
- **Per-object locks:** Fine-grained locks on containers (dicts, lists) to protect concurrent access. Not a lock per *object* (too expensive), but per *container* (acceptable overhead for the data structures that are actually shared).
- **A concurrent garbage collector:** Replaces the stop-the-world GC with one that can run concurrently with mutator threads.

### Why It's Not Magic

The free-threaded build works. Multi-threaded CPU-bound Python code can genuinely use multiple cores. Even so:

1. **Single-threaded performance regresses.** The biased reference counting and per-container locks add overhead even when only one thread is running. Early benchmarks show 5-15% slowdown for single-threaded workloads. This is much better than the 30-40% slowdowns of earlier attempts, though it's still not free.

2. **C extensions need to opt in.** Extensions must declare themselves free-thread-safe by setting a flag. Unsafe extensions still trigger a fallback GIL for compatibility. Many popular extensions (NumPy has made major progress, though the long tail is not trivial) have had to audit decades of C assumptions.

3. **Thread-safe Python code is still hard.** Removing the GIL doesn't magically make concurrent programming easy. You still need to think about shared state, synchronization, and data races. The GIL wasn't hiding bugs, though it was preventing a class of bugs that Python developers have never had to think about. Code that was "accidentally thread-safe" because of the GIL may now have real race conditions.

4. **It's opt-in.** The free-threaded build started as a separate build of CPython, not the default (`python3.13t` or similar). Making free-threading the default across the board is a multi-year rollout, contingent on ecosystem readiness.

5. **The ecosystem migration takes years.** Every C extension needs testing and potentially modification. This is a bigger migration than Python 2 to 3 in some ways, because it affects the C-level assumptions that extension authors have relied on for decades.

## Why Not Just Use multiprocessing?

"Just use `multiprocessing`" is the standard GIL workaround. Each process has its own GIL, its own memory space, and its own Python interpreter. True parallelism.

It works, with caveats:

- **Process startup is heavy.** Spawning a new process takes 50-100ms and duplicates the entire memory space. Compare to goroutines (microseconds, kilobytes).
- **Data sharing is painful.** Processes don't share memory. Passing data between processes requires serialization (pickle), shared memory objects, or pipes. For large data structures, the serialization cost can negate the parallelism benefit.
- **No shared state.** Global caches, connection pools, in-memory indexes: none of these can be trivially shared across processes. You need explicit IPC mechanisms.

`multiprocessing` is a pragmatic solution, not an elegant one. It works for embarrassingly parallel workloads (process N independent items) and falls apart for tightly coupled concurrent workloads (producers and consumers sharing a queue, concurrent access to a shared cache).

## The Honest Assessment

The GIL exists because Python chose simplicity and C extension compatibility over multi-core parallelism. That was the right trade-off in 1992, when most computers had one core. It was increasingly painful by 2010. And by 2024, it was the single biggest technical limitation of the language.

Python 3.13's free-threaded build is a serious, well-engineered solution. It is the path to a GIL-free default, though "eventually" means years, not months. The ecosystem has to migrate, single-threaded overhead has to shrink, and the sharp edges around thread safety need documentation and tooling.

In the meantime, if you need CPU-bound parallelism in Python, your options are:
- `multiprocessing` (works now, clunky)
- NumPy/pandas/PyTorch (internally bypass the GIL with C/CUDA code)
- Cython or C extensions (release the GIL in compute-heavy sections)
- Write the hot path in Go or Rust and call it from Python

And if you're starting a new project where multi-core CPU parallelism is a fundamental requirement (not a nice-to-have), consider whether Python is the right language for that specific component. The GIL is a symptom of a deeper design choice: Python optimizes for developer productivity, not for raw performance. That trade-off is usually worth it. When it's not, the answer isn't "fix the GIL." It's "use the right tool."

*The GIL is Python's most criticized feature, and it deserves the criticism. Still, it also deserves understanding. It's not a mistake. It's a trade-off that made Python the most accessible, most extensible, and most widely used programming language in the world. The cost was multi-core parallelism. The benefit was everything else.*
