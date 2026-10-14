"""Test de fumée de dist/preview.html dans Chromium (Playwright). Usage : python3 scripts/smoke_preview.py"""
import json
import pathlib
from playwright.sync_api import sync_playwright

URL = pathlib.Path("dist/preview.html").resolve().as_uri()

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    page_errors = []
    pg.on("pageerror", lambda e: page_errors.append(str(e)))
    pg.goto(URL, wait_until="domcontentloaded")
    pg.wait_for_selector("#stage svg")
    assert pg.inner_text("#status").startswith("Valide"), pg.inner_text("#status")

    pg.click('[data-scene="showcase"]')
    assert "7 objets" in pg.inner_text("#status")

    pg.click('[data-scene="robots"]')
    assert "3 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="anatomy"]')
    assert pg.inner_text("#status").startswith("Valide"), pg.inner_text("#status")
    pg.click('[data-scene="face"]')
    assert pg.inner_text("#status").startswith("Valide"), pg.inner_text("#status")
    pg.click('[data-scene="hosts"]')
    assert pg.inner_text("#status").startswith("Valide"), pg.inner_text("#status")
    pg.click('[data-scene="expressions"]')
    assert "7 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="gallery"]')
    assert "48 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="coordination"]')
    assert pg.inner_text("#status").startswith("Valide"), pg.inner_text("#status")
    pg.click('[data-scene="eyestyles"]')
    assert "4 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="archetypes"]')
    assert "6 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="newkinds"]')
    assert "2 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="pupils"]')
    assert "5 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="lashengine"]')
    assert "5 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="pairs"]')
    assert "96 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="gazesheet"]')
    assert "60 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="headturn"]')
    assert "4 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="newexpr"]')
    assert "7 objets" in pg.inner_text("#status"), pg.inner_text("#status")
    pg.click('[data-scene="showcase"]')
    assert "7 objets" in pg.inner_text("#status")

    pg.focus("#dial")
    for _ in range(3):
        pg.keyboard.press("ArrowLeft")
        pg.wait_for_timeout(60)
    pg.wait_for_timeout(200)
    az = json.loads(pg.input_value("#spec"))["light"]["azimuthDeg"]
    assert az == 315, az  # 330 - 3*5

    pg.fill("#spec", '{"objects": [{"kind":"eye","id":"A"}]}')
    pg.wait_for_timeout(400)
    assert pg.get_attribute("#stage", "data-stale") is not None
    assert "refusée" in pg.inner_text("#status")

    m = b.new_page(viewport={"width": 390, "height": 844})
    m.goto(URL, wait_until="domcontentloaded")
    m.wait_for_selector("#stage svg")
    assert m.evaluate("document.documentElement.scrollWidth") <= 390

    assert not page_errors, page_errors
    b.close()
print("smoke OK")
