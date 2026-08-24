from marul3d_api.models import CadDocument, ExtrudeFeature, SketchFeature
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
