#!/usr/bin/env bash
# Group staged files by their package directory and run that package's
# eslint on them. Required because ESLint v9 flat config resolves from
# CWD, not from the file path, so we must cd into each package first.
set -e

[ "$#" -eq 0 ] && exit 0

files=("$@")
seen_apps=""
exit_code=0

for f in "${files[@]}"; do
  case "$f" in
    apps/*/*|packages/*/*) ;;
    *) continue ;;
  esac

  app=$(printf '%s\n' "$f" | cut -d/ -f1-2)

  case " $seen_apps " in
    *" $app "*) continue ;;
  esac
  seen_apps="$seen_apps $app"

  if [ ! -f "$app/eslint.config.js" ] && [ ! -f "$app/eslint.config.mjs" ] && [ ! -f "$app/eslint.config.cjs" ]; then
    continue
  fi

  app_files=""
  for g in "${files[@]}"; do
    case "$g" in
      "$app/"*)
        app_files="$app_files ${g#$app/}"
        ;;
    esac
  done

  if [ -n "$app_files" ]; then
    # shellcheck disable=SC2086
    (cd "$app" && pnpm exec eslint --fix --no-warn-ignored $app_files) || exit_code=$?
  fi
done

exit $exit_code
