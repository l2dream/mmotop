# Working on this repository

## Shipping changes

The owner wants every finished change live on the site straight away.
After committing and pushing a change to the working branch:

1. Open a pull request from that branch into `main`.
2. Merge it right away (merge commit), without waiting to be asked.

`main` deploys to GitHub Pages automatically (`.github/workflows/deploy.yml`).
Before pushing, make sure `npm run typecheck` passes: the deploy runs it and
stops on a type error.

The owner writes in Russian; answer in Russian.
