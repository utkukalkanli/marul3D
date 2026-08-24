# Parametric rebuild cache

marul3D persists an OpenCascade B-rep checkpoint after every successfully built
feature. Checkpoints live under each object's local `cache/brep` directory; they
are implementation artifacts and never leave the Mac.

Each checkpoint key chains the previous key with the current feature's
geometry-affecting data. The chain makes feature ordering, dependencies,
suppression, and all earlier parameters part of every later checkpoint. Display
names and document revisions are deliberately excluded because they do not alter
geometry. Imported STEP/STL source size and modification time, the document
schema, units, and CadQuery version are included for conservative invalidation.

When a parameter changes, the builder loads the deepest matching B-rep prefix and
rebuilds only the dirty feature and its suffix. A last-feature edit therefore
reuses every earlier solid. Undo, redo, and returning to an earlier parameter
value can reuse a complete prior result. Broken or unreadable entries are deleted
and rebuilt automatically, so the cache is never authoritative.

The cache keeps the 256 most recently used checkpoints per object. This bounds
local storage while retaining useful checkpoints across app restarts.

The Properties Inspector uses the same incremental path. Slider movement updates
the UI immediately and sends a build after a short debounce or when the gesture
ends, avoiding a backend rebuild for every pointer event. Unit selection is a
display conversion only; persisted feature parameters remain in millimetres.
