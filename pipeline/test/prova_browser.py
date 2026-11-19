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
        for nome, lat, lon in [("lodi", 45.25, 9.55), ("maccarese", 41.86, 12.23), ("muccese", 43.1167, 13.0524)]:
            await pg.goto(f"http://127.0.0.1:8770/index.html?lang=it&r={nome}#15/{lat}/{lon}/sat")
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
        await pg.locator('.ch-tabs .seg[data-ch="chClms"]').click(); await pg.wait_for_timeout(15000)
        rep["copernicus_campo"] = await pg.locator("#clmsSt").inner_text()
        print("copernicus campo:", rep["copernicus_campo"])
        await pg.screenshot(path=os.path.join(OUT, "browser_copernicus_serie.png"))
        await pg.evaluate("openSection('services')")      # coltura, suolo, avvisi stanno nella sezione Servizi della barra laterale
        await pg.wait_for_timeout(1000)
        rep["avvisi"] = await pg.locator("#fpAdvice").inner_text()
        print("avvisi:", rep["avvisi"][:300].replace("\n", " | "))
        # riconoscimento della coltura: annata in corso e annata 2023/24 (confronto con la mappa Copernicus 2024)
        await pg.wait_for_timeout(20000)
        rep["modello_annata_corrente"] = await pg.locator("#fpModel").inner_text()
        await pg.select_option("#fpYear", "2023"); await pg.wait_for_timeout(70000)
        rep["modello_2024"] = await pg.locator("#fpModel").inner_text()
        rep["copernicus"] = await pg.locator("#fpCty").inner_text()
        print("modello corrente:", rep["modello_annata_corrente"][:200].replace("\n", " | "))
        print("modello 2023/24:", rep["modello_2024"][:200].replace("\n", " | "))
        print("copernicus:", rep["copernicus"][:200].replace("\n", " | "))
        rep["pannello"] = await pg.evaluate("""() => ({ titolo: document.querySelector('.fp-title')?.innerText, suolo: document.querySelector('#fpSoil')?.innerText,
          resa: document.querySelector('#fpFieldYield')?.innerText, stato: document.querySelector('#fpStatus')?.innerText, mappa: document.querySelector('#fmStats')?.innerText })""")
        print(json.dumps(rep["pannello"], ensure_ascii=False, indent=1))
        await pg.screenshot(path=os.path.join(OUT, "browser_pannello.png"), full_page=False)
        rep["suolo"] = await pg.locator("#fpSoil").inner_text()
        rep["carbonio"] = await pg.locator("#fpCarbon").inner_text()
        print("suolo:", rep["suolo"][:300].replace("\n", " | "))
        print("carbonio:", rep["carbonio"][-500:].replace("\n", " | "))
        # più campi: aggiunge il secondo campo più grande (come Ctrl + clic), confronto per id e scatter LAI contro NDVI
        await pg.evaluate("""() => { const fs = Segment.allFields().features.slice().sort((a, b) => {
            const A = (f) => { const x = L.geoJSON(f).getBounds(); return (x.getEast()-x.getWest())*(x.getNorth()-x.getSouth()); }; return A(b) - A(a); });
          Live.analyze(JSON.parse(JSON.stringify(fs[1])), {}, true); }""")
        await pg.wait_for_timeout(60000)
        rep["campi_selezionati"] = await pg.evaluate("Clip.ids()")
        await pg.evaluate("openSection('compare')"); await pg.wait_for_timeout(1000)
        await pg.click("#scRun"); await pg.wait_for_timeout(20000)
        rep["scatter"] = await pg.locator("#scMsg").inner_text()
        print("campi:", rep["campi_selezionati"], "scatter:", rep["scatter"])
        await pg.screenshot(path=os.path.join(OUT, "browser_confronto.png"))
        # resa annata per annata del campo attivo
        await pg.evaluate("openSection('services')"); await pg.click("#yyRun"); await pg.wait_for_timeout(150000)
        rep["resa_annate"] = (await pg.locator("#yyBox").inner_text())[:600]
        print("resa annate:", rep["resa_annate"].replace("\n", " | "))
        await pg.screenshot(path=os.path.join(OUT, "browser_resa_annate.png"))
        # rilevamento di campi e colture nell'area visibile
        # zoom 13: area di circa 13 × 12 km, elaborata a blocchi di 3 × 3 tasselli
        await pg.evaluate("map.setView([45.25, 9.55], 13, { animate: false }); openSection('fields')"); await pg.wait_for_timeout(1500)
        await pg.evaluate("Tools.detectView()")
        t0 = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - t0 < 900:
            await pg.wait_for_timeout(10000)
            txt = await pg.locator("#toolArea").inner_text()
            if "GeoJSON" in txt or "non riuscit" in txt or "troppo grande" in txt: break
        rep["rilevamento"] = (await pg.locator("#toolArea").inner_text())[:300]
        rep["rilevamento_s"] = round(asyncio.get_event_loop().time() - t0)
        rep["rilevamento_area_km"] = await pg.evaluate("(() => { const b = map.getBounds(); return [(b.getEast()-b.getWest())*111.32*Math.cos(b.getCenter().lat*Math.PI/180), (b.getNorth()-b.getSouth())*110.54].map(x => +x.toFixed(1)); })()")
        print("rilevamento:", rep["rilevamento_s"], "s", rep["rilevamento_area_km"], "km", rep["rilevamento"].replace("\n", " | "))
        await pg.screenshot(path=os.path.join(OUT, "browser_rilevamento.png"))
        # PAW, finestra dei livelli, province e regioni
        await pg.evaluate("document.getElementById('chk_so_paw').click(); toggleLayerWin(true); map.setView([45.25, 9.55], 11)"); await pg.wait_for_timeout(12000)
        await pg.screenshot(path=os.path.join(OUT, "browser_paw.png"))
        await pg.evaluate("document.getElementById('chk_so_paw').click()")
        await pg.evaluate("openTab('regions')"); await pg.wait_for_timeout(2000)
        await pg.click(".reg-views [data-v=rese]"); await pg.wait_for_timeout(4000)
        rep["regioni_rese"] = (await pg.locator("#regionsPanel").inner_text())[:300]
        await pg.screenshot(path=os.path.join(OUT, "browser_regioni_rese.png"))
        await pg.evaluate("openTab('maps')")
        # mappe del suolo
        for lay in ["so_tessitura", "so_stock_soc"]:
            await pg.evaluate(f"document.getElementById('chk_{lay}').click()"); await pg.wait_for_timeout(500)
            await pg.evaluate("map.setView([42.0, 12.6], 9)"); await pg.wait_for_timeout(12000)
            await pg.screenshot(path=os.path.join(OUT, f"browser_{lay}.png"))
            await pg.evaluate(f"document.getElementById('chk_{lay}').click()"); await pg.wait_for_timeout(500)
        # layer Copernicus LAI sulla mappa
        await pg.evaluate("document.getElementById('chk_cl_lai').click()"); await pg.wait_for_timeout(1000)
        await pg.evaluate("map.setView([43.5, 12.5], 8)"); await pg.wait_for_timeout(12000)
        await pg.screenshot(path=os.path.join(OUT, "browser_copernicus_lai.png"))
        # dove sta "Località Strada" (Camerino)?
        rep["strada"] = await pg.evaluate("fetch('https://photon.komoot.io/api/?q=Strada&osm_tag=place&lat=43.13&lon=13.06&limit=3').then(r=>r.json()).then(j=>j.features.map(f=>[f.properties.name,f.properties.city||f.properties.county,f.geometry.coordinates]))")
        print("strada", rep["strada"])
        # ricerca luoghi (mappa centrata vicino a Macerata)
        await pg.evaluate("map.setView([43.07, 13.11], 13)"); await pg.wait_for_timeout(1500)
        for q in ["maceratta", "Località Strada", "Strada", "Muccia", "41.86, 12.23", "Sant Angelo Lodigiano"]:
            await pg.fill("#searchInput", q); await pg.wait_for_timeout(2500)
            rep["ricerca " + q] = (await pg.locator("#searchResults").inner_text())[:300]
            print(q, "->", rep["ricerca " + q].replace("\n", " | "))
        rep["errori"] = errs[:30]
        json.dump(rep, open(os.path.join(OUT, "browser.json"), "w"), ensure_ascii=False, indent=1)
        await b.close()
asyncio.run(main())
