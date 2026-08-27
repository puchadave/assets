import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "img" / "manifest.json"


def test_manifest_schema_and_paths():
    manifest = json.loads(MANIFEST_PATH.read_text())
    assert {"schema", "version", "canonicalRawBase", "brands"} <= manifest.keys()
    brands = manifest["brands"]
    assert len({brand["id"] for brand in brands}) == len(brands)
    for brand in brands:
        assert {"id", "name", "type", "path", "description", "assets"} <= brand.keys()
        assert (ROOT / brand["path"]).is_dir()
        for asset in brand["assets"]:
            assert {"label", "role"} <= asset.keys()
            if "path" in asset:
                assert (ROOT / asset["path"]).is_file()
    assert manifest["canonicalRawBase"].endswith("/")
