# Prova del sito in un browser vero (Chromium) con accesso alla rete: Delineate Anything nel browser, pannello del campo, suolo.
import asyncio, threading, http.server, functools, os, json
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
threading.Thread(target=lambda: http.server.ThreadingHTTPServer(("127.0.0.1", 8770), functools.partial(Q, directory=ROOT)).serve_forever(), daemon=True).start()
OUT = os.path.join(ROOT, "prove"); os.makedirs(OUT, exist_ok=True)
async def main():
    rep = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1400, "height": 950})
        await pg.add_init_script("try{localStorage.setItem('campiAperti.benvenuto','1')}catch(e){}")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: (m.type in ("error", "warning") or "divisi" in m.text) and errs.append(m.text[:300]))
        for nome, lat, lon in [("lodi", 45.25, 9.55), ("maccarese", 41.86, 12.23), ("muccese", 43.0726, 13.1103)]:
            await pg.goto(f"http://127.0.0.1:8770/index.html?lang=it#15/{lat}/{lon}/sat")
            await pg.wait_for_timeout(3000)
            t = await pg.evaluate(f"""async () => {{
              const t0 = performance.now();
              try {{
                const r = await Delineate.run([{lon}-0.012, {lat}-0.009, {lon}+0.012, {lat}+0.009], new Date(), () => {{}});
                const fc = Segment.allFields();
                return {{ ok: true, s: (performance.now() - t0) / 1000, campi: fc.features.length, date: r.dates, W: r.W, H: r.H }};
              }} catch (e) {{ return {{ ok: false, err: String(e), s: (performance.now() - t0) / 1000 }}; }}
            }}""")
            rep[nome] = t
            print(nome, t, flush=True)
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=os.path.join(OUT, f"browser_{nome}.png"))
        # clic su un campo: pannello, suolo, mappa 10 m
        await pg.goto("http://127.0.0.1:8770/index.html?lang=it#15/45.25/9.55/sat")
        await pg.wait_for_timeout(3000)
        pt = await pg.evaluate("""async () => {
          await Delineate.run([9.538, 45.241, 9.562, 45.259], new Date(), () => {});
          const fc = Segment.allFields(); let best = null, A = 0;
          fc.features.forEach((f) => { const b = L.geoJSON(f).getBounds(); const a = (b.getEast()-b.getWest())*(b.getNorth()-b.getSouth()); if (a > A) { A = a; best = b.getCenter(); } });
          map.setView(best, 16); await new Promise((r) => setTimeout(r, 1500));
          const p = map.latLngToContainerPoint(best), r = map.getContainer().getBoundingClientRect();
          return [p.x + r.left, p.y + r.top];
        }""")
        await pg.mouse.click(pt[0], pt[1])
        await pg.wait_for_timeout(60000)
        rep["pannello"] = await pg.evaluate("""() => ({ titolo: document.querySelector('.fp-title')?.innerText, suolo: document.querySelector('#fpSoil')?.innerText,
          resa: document.querySelector('#fpFieldYield')?.innerText, stato: document.querySelector('#fpStatus')?.innerText, mappa: document.querySelector('#fmStats')?.innerText })""")
        print(json.dumps(rep["pannello"], ensure_ascii=False, indent=1))
        await pg.screenshot(path=os.path.join(OUT, "browser_pannello.png"), full_page=False)
        # ricerca luoghi
        for q in ["maceratta", "Località Strada", "41.86, 12.23", "Sant Angelo Lodigiano"]:
            await pg.fill("#searchInput", q); await pg.wait_for_timeout(2500)
            rep["ricerca " + q] = (await pg.locator("#searchResults").inner_text())[:300]
            print(q, "->", rep["ricerca " + q].replace("\n", " | "))
        rep["errori"] = errs[:30]
        json.dump(rep, open(os.path.join(OUT, "browser.json"), "w"), ensure_ascii=False, indent=1)
        await b.close()
asyncio.run(main())
