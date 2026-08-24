from marul3d_api.models import (
    BoxFeature,
    CadDocument,
    CylinderFeature,
    ExtrudeFeature,
    HolePatternFeature,
    ImportStepFeature,
    Point2D,
    SketchFeature,
)
from marul3d_api.project_store import ProjectStore


def test_undo_and_redo_survive_store_restart(tmp_path) -> None:
    initial = CadDocument(
        id="persistent-history",
        name="Original",
        features=[
            SketchFeature(id="sketch", name="Sketch", width=20, height=10),
            ExtrudeFeature(
                id="extrude",
                name="Extrude",
                sketch_id="sketch",
                depends_on=["sketch"],
                distance=4,
            ),
        ],
    )
    store = ProjectStore(tmp_path, initial_document=initial)
    changed = store.document()
    changed.name = "Changed"
    store.apply(changed)

    restarted = ProjectStore(tmp_path)
    assert restarted.undo().name == "Original"

    restarted_again = ProjectStore(tmp_path)
    assert restarted_again.redo().name == "Changed"


def test_parametric_edits_rebuild_only_the_dirty_feature_suffix(tmp_path) -> None:
    initial = CadDocument(
        id="cached-part",
        name="Cached part",
        features=[
            BoxFeature(id="base", name="Base", width=40, depth=30, height=8),
            CylinderFeature(
                id="boss",
                name="Boss",
                depends_on=["base"],
                radius=7,
                height=5,
            ),
            HolePatternFeature(
                id="hole",
                name="Hole",
                depends_on=["boss"],
                diameter=3,
                points=[Point2D(x=0, y=0)],
            ),
        ],
    )
    store = ProjectStore(tmp_path, initial_document=initial)
    assert store.last_build_stats == {
        "cache_hit_features": 0,
        "rebuilt_features": 3,
        "cache_writes": 3,
    }

    hole_edit = store.document()
    hole_edit.features[2].diameter = 4
    store.apply(hole_edit)
    assert store.last_build_stats["cache_hit_features"] == 2
    assert store.last_build_stats["rebuilt_features"] == 1

    base_edit = store.document()
    base_edit.features[0].width = 44
    store.apply(base_edit)
    assert store.last_build_stats["cache_hit_features"] == 0
    assert store.last_build_stats["rebuilt_features"] == 3

    store.undo()
    assert store.last_build_stats["cache_hit_features"] == 3
    assert store.last_build_stats["rebuilt_features"] == 0
    assert len(list((tmp_path / "cache" / "brep").glob("*.brep"))) >= 6

    renamed = store.document()
    renamed.features[2].name = "Renamed hole pattern"
    store.apply(renamed)
    assert store.last_build_stats["cache_hit_features"] == 3
    assert store.last_build_stats["rebuilt_features"] == 0

    final_key = store._prefix_hashes(store.document())[-1]
    (store.brep_cache / f"{final_key}.brep").write_text("corrupt", encoding="utf-8")
    store.export("step")
    assert store.last_build_stats["cache_hit_features"] == 2
    assert store.last_build_stats["rebuilt_features"] == 1


def test_import_file_changes_invalidate_prefix_cache_keys(tmp_path) -> None:
    store = ProjectStore(tmp_path)
    source = tmp_path / "imports" / "base.step"
    source.write_bytes(b"first immutable import")
    document = CadDocument(
        features=[
            ImportStepFeature(
                id="imported-base",
                name="Imported base",
                source_path=str(source),
            )
        ]
    )
    first_key = store._prefix_hashes(document)[0]
    source.write_bytes(b"changed immutable import with a different size")
    assert store._prefix_hashes(document)[0] != first_key
