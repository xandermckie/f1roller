from app.services.statsf1_scraper import parse_driver_page


SAMPLE_HTML = """
<html><body>
<h1>Ayrton Senna</h1>
<table>
<tr><th>Grand Prix</th><td>161</td></tr>
<tr><th>Victories</th><td>41</td></tr>
<tr><th>Pole positions</th><td>65</td></tr>
<tr><th>Podiums</th><td>80</td></tr>
<tr><th>Average finish</th><td>3.2</td></tr>
<tr><th>World championships</th><td>3</td></tr>
</table>
</body></html>
"""


def test_parse_driver_page_extracts_stats():
    result = parse_driver_page(SAMPLE_HTML, "ayrton-senna")
    assert result["display_name"] == "Ayrton Senna"
    assert result["stats"]["wins"] == 41
    assert result["stats"]["poles"] == 65
    assert result["stats"]["gp_starts"] == 161


def test_parse_malformed_html_graceful():
    result = parse_driver_page("<html></html>", "unknown-driver")
    assert result["slug"] == "unknown-driver"
    assert result["stats"]["wins"] == 0
