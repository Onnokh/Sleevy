# Five App Workspaces

Sleeve structures the monorepo around five runnable app workspaces: `apps/api`, `apps/web`, `apps/ios`, `apps/chrome-extension`, and `apps/raycast-plugin`. This keeps each deployable surface explicit without introducing an extra shared core package before one is needed.
