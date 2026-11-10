# Safe GitHub autosync

`tools/autosync.sh` creates and pushes checkpoint commits while work continues on a feature branch.

```sh
./tools/autosync.sh start
./tools/autosync.sh status
./tools/autosync.sh log
./tools/autosync.sh stop
```

The default interval is 60 seconds. To change it for one run:

```sh
AUTOSYNC_INTERVAL_SECONDS=120 ./tools/autosync.sh start
```

## Safety rules

- Refuses `main`, `master`, `production` and `prod`.
- Refuses to start from a detached commit.
- Never pulls, rebases, force-pushes or overwrites remote work.
- Stops if the remote branch contains commits that are not local.
- Refuses pre-existing staged changes so it does not take over a manual commit.
- Uses Git ignore rules and additionally blocks common secret and credential paths.
- Runs `git diff --cached --check` before each checkpoint.
- Stores its PID, lock and log under `.git/autosync`, outside committed files.

Autosync is a checkpoint helper, not a replacement for reviewed commits. Stop it before merging or changing branches.
