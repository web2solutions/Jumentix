#!/bin/sh
# Ignored Build Step for the commercial website.
#
# Vercel runs this before install. Exit 0 skips the build. Exit 1 continues it.
# Dependabot pull requests use a head ref of dependabot/... and must not start
# a preview deployment. A merge onto dev or main keeps that ref, so the landed
# bump still builds. An unset ref (CLI deploy) also builds.
ref="${VERCEL_GIT_COMMIT_REF-}"
case "$ref" in
  dependabot/*|refs/heads/dependabot/*)
    echo "Skipping Vercel build for Dependabot ref ${ref}"
    exit 0
    ;;
esac
if [ -n "$ref" ]; then
  echo "Continuing Vercel build for ref ${ref}"
else
  echo "Continuing Vercel build; VERCEL_GIT_COMMIT_REF is unset"
fi
exit 1
