# kartikmadaan.github.io

Personal portfolio site built with [Hugo](https://gohugo.io/) (extended) and the [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme.

## Local development

Requires Hugo **extended** (this repo targets `0.168.0` in CI; match locally when possible).

```bash
git submodule update --init --recursive
hugo server -D
```

Open [http://localhost:1313](http://localhost:1313).

Production build:

```bash
hugo --minify
```

Output lands in `public/` (gitignored).

## Add a TIL post

```bash
hugo new content til/YYYY-MM-DD-short-slug.md
```

Front matter at minimum:

```yaml
title: "..."
date: YYYY-MM-DD
draft: false
summary: "One line for cards and SEO."
tags: ["optional"]
```

Write ~200–500 words in the body, then verify at `/til/`.

## GitHub Pages

1. Create an empty GitHub repo `kartikmadaan.github.io` (if not already).
2. Add remote: `git remote add origin git@github.com:kartikmadaan/kartikmadaan.github.io.git`
3. Commit and push to `main` when ready.
4. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. After the workflow succeeds, the site should be at [https://kartikmadaan.github.io](https://kartikmadaan.github.io).

The deploy workflow is `.github/workflows/hugo.yml` (pinned Hugo extended `0.168.0`, submodules enabled for PaperMod).

## Analytics

GoatCounter / Plausible hooks are documented in `hugo.toml` comments—do not enable without a real site id.
