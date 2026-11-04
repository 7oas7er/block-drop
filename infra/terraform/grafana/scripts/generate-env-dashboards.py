#!/usr/bin/env python3
"""Generate Block Drop Production / Staging Grafana dashboard JSON.

Run from repo:
  python3 infra/terraform/grafana/scripts/generate-env-dashboards.py

Outputs:
  infra/terraform/grafana/dashboards/block-drop-prod.json
  infra/terraform/grafana/dashboards/block-drop-stg.json

Cloudflare Free Adaptive Analytics limits (verified against the zone):
  - max query span ~30d (4w2d); no datetimeDay_ASC enum
  - edgeTimeToFirstByteMs not entitled; use avg.originResponseDurationMs
  - year windows use CloudWatch scrape → Grafana Cloud Prometheus (Free retains 14d)

Infinity fixed-window panels MUST use ${__timeFrom}/${__timeTo} (backend macros that
honor panel timeFrom). Grafana ${__from}/${__to} are dashboard-picker only — using them
makes Last month/year look empty while hour/day/week still appear to work.

Traffic y-axis is request rate (req/s), not absolute bucket counts, so Last hour /
day / week / month share a comparable scale:
  CF Adaptive:  req/s = count / bucket_seconds
                datetimeMinute → /60 ; datetimeHour → /3600
                (Infinity backend computed_columns — NOT panel calculateField)
  CloudWatch year: sum(rate(aws_cloudfront_requests_sum{…}[1h]))  # Prom rate = /s

Traffic hour/day/week/month panels overlay the previous equal window via **two
Infinity queries** (not Grafana panel timeCompare). timeCompare + Infinity is
what produced the recurring “Data is missing a number field” / “No data” cycle
(#144–#148): compare frames rename fields, string-typed computed `req/s`, and
filter/convert transforms cannot reliably yield FieldType.number for bars.

  Query A — current window: `${__timeFrom:date:iso}` / `${__timeTo:date:iso}`
  Query B — prior equal window: `datetime_leq: ${__timeFrom:date:iso}` (prior
            ends where current starts), loose `datetime_geq` (start of that
            calendar month, within CF Free ~30d), `limit` = bucket count,
            `orderBy` DESC so the newest N buckets are exactly the prior
            window; UQL `add_datetime(+shift)` aligns timestamps onto the
            current x-axis and `tonumber` makes `req/s` a real number field.

Bars = A (current); dashed line = B (prior). Only those two series (drop raw
Adaptive count via filterFieldsByName). Hide the Traffic legend. Last year has
no YoY / prior-period compare.

Infinity backend PostProcessFrame IGNORES computed_columns.type (selector + text
only). After filterFieldsByName drops numeric `requests`, force `req/s` to
number with panel convertFieldType (overrides are display-only).
"""

from __future__ import annotations

import json
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parents[1] / "dashboards"

# source: "cf" = Infinity GraphQL; "cw" = CloudWatch via Prometheus (Grafana Free retention)
# bucket_seconds: CF Adaptive group width — used to convert count → req/s.
WINDOWS = [
    {
        "title": "Last hour",
        "time_from": "now-1h",
        "source": "cf",
        "dim": "datetimeMinute",
        "order_by": "datetimeMinute_ASC",
        "bucket_seconds": 60,
        # Prior equal window: shift timestamps forward by this duration for overlay.
        "prior_shift": "1h",
        "prior_buckets": 60,
    },
    {
        "title": "Last day",
        "time_from": "now-1d",
        "source": "cf",
        "dim": "datetimeHour",
        "order_by": "datetimeHour_ASC",
        "bucket_seconds": 3600,
        "prior_shift": "1d",
        "prior_buckets": 24,
    },
    {
        "title": "Last week",
        "time_from": "now-7d",
        "source": "cf",
        "dim": "datetimeHour",
        "order_by": "datetimeHour_ASC",
        "bucket_seconds": 3600,
        "prior_shift": "7d",
        "prior_buckets": 168,
    },
    {
        # CF Free maxDuration ≈ 30d; stay under inclusive-bound edge (now-30d can exceed).
        "title": "Last month",
        "time_from": "now-29d",
        "source": "cf",
        "dim": "datetimeHour",
        "order_by": "datetimeHour_ASC",
        "bucket_seconds": 3600,
        "prior_shift": "29d",
        "prior_buckets": 696,  # 29 * 24
    },
    {
        # Grafana Cloud Free metrics retention is 14d — year panels stay empty on Free
        # until a native CloudWatch DS (or Pro retention) is wired. Keep the window for
        # layout parity; descriptions document the limit.
        "title": "Last year",
        "time_from": "now-365d",
        "source": "cw",
        "dim": None,
        "order_by": None,
        "bucket_seconds": None,
        "prior_shift": None,
        "prior_buckets": None,
    },
]

# Traffic / errors / latency: half prior height (7→4), twice prior width (4→8).
# 3 panels per row (24-wide grid); 5 windows → 2 rows (3 + 2).
METRIC_PANEL_H = 4
METRIC_PANEL_W = 8
METRIC_PANELS_PER_ROW = 3


def metric_grid_pos(index: int, y_start: int) -> dict:
    row, col = divmod(index, METRIC_PANELS_PER_ROW)
    return {
        "h": METRIC_PANEL_H,
        "w": METRIC_PANEL_W,
        "x": col * METRIC_PANEL_W,
        "y": y_start + row * METRIC_PANEL_H,
    }


def metric_section_height() -> int:
    rows = (len(WINDOWS) + METRIC_PANELS_PER_ROW - 1) // METRIC_PANELS_PER_ROW
    return rows * METRIC_PANEL_H

ENVS = {
    "prod": {
        "uid": "block-drop-prod",
        "title": "Block Drop — Production",
        "environment": "prod",
        "host": "blockdrop.7oas7er.com",
        "probe_job": "block-drop-prod-site",
        "probe_job_scores": "block-drop-prod-scores",
        "cf_name": "prod-block-drop-site-distribution",
    },
    "stg": {
        "uid": "block-drop-stg",
        "title": "Block Drop — Staging",
        "environment": "stg",
        "host": "blockdrop-stg.7oas7er.com",
        "probe_job": "block-drop-stg-site",
        "probe_job_scores": "block-drop-stg-scores",
        "cf_name": "stg-block-drop-site-distribution",
    },
}


def ts_field(unit: str = "short", *, bars: bool = False) -> dict:
    if bars:
        custom = {
            "drawStyle": "bars",
            "lineWidth": 1,
            "fillOpacity": 80,
            "spanNulls": False,
            "showPoints": "never",
            "barAlignment": 0,
        }
    else:
        custom = {
            "drawStyle": "line",
            "lineWidth": 2,
            "fillOpacity": 10,
            "spanNulls": False,
            "showPoints": "auto",
        }
    return {
        "defaults": {
            "unit": unit,
            "custom": custom,
        },
        "overrides": [],
    }


def ts_options() -> dict:
    return {
        "legend": {"displayMode": "list", "placement": "bottom", "showLegend": True},
        "tooltip": {"mode": "multi", "sort": "none"},
    }


def row(panel_id: int, title: str, y: int) -> dict:
    return {
        "type": "row",
        "title": title,
        "gridPos": {"h": 1, "w": 24, "x": 0, "y": y},
        "id": panel_id,
        "collapsed": False,
    }


def cf_infinity(
    ref_id: str,
    *,
    dataset: str,
    columns: list[dict],
    query_body: str,
    root_selector: str,
    fmt: str = "timeseries",
    computed_columns: list[dict] | None = None,
    parser: str = "backend",
    uql: str | None = None,
) -> dict:
    """Infinity GraphQL target. Query must live in url_options.body_graphql_query."""
    target: dict = {
        "refId": ref_id,
        "type": "graphql",
        "source": "url",
        "format": fmt,
        "url": "https://api.cloudflare.com/client/v4/graphql",
        "url_options": {
            "method": "POST",
            "data": query_body,
            "body_type": "graphql",
            "body_content_type": "application/json",
            "body_graphql_query": query_body,
        },
        "parser": parser,
        "root_selector": root_selector,
        "columns": columns,
        "filters": [],
        "data": "",
    }
    if computed_columns:
        # Backend parser: per-row expressions (e.g. requests / 60 → req/s).
        target["computed_columns"] = computed_columns
    if uql:
        target["uql"] = uql
    return target


def cf_graphql(
    ref_id: str,
    host: str,
    dim: str,
    order_by: str,
    columns: list[dict],
    extra_filter: str = "",
    avg_fields: list[str] | None = None,
    sum_fields: list[str] | None = None,
    *,
    limit: int = 2000,
    fmt: str = "timeseries",
    eyeball: bool = False,
    computed_columns: list[dict] | None = None,
    datetime_geq: str = "${__timeFrom:date:iso}",
    datetime_leq: str = "${__timeTo:date:iso}",
    parser: str = "backend",
    uql: str | None = None,
    root_selector: str = "data.viewer.zones.0.httpRequestsAdaptiveGroups",
) -> dict:
    avg_block = ""
    if avg_fields:
        inner = "\n".join(f"          {f}" for f in avg_fields)
        avg_block = f"\n        avg {{\n{inner}\n        }}"
    sum_block = ""
    if sum_fields:
        inner = "\n".join(f"          {f}" for f in sum_fields)
        sum_block = f"\n        sum {{\n{inner}\n        }}"
    eyeball_line = '          requestSource: "eyeball"\n' if eyeball else ""
    data = (
        "query {\n"
        "  viewer {\n"
        '    zones(filter: { zoneTag: "${cf_zone}" }) {\n'
        "      httpRequestsAdaptiveGroups(\n"
        f"        limit: {limit}\n"
        f"        orderBy: [{order_by}]\n"
        "        filter: {\n"
        f'          datetime_geq: "{datetime_geq}"\n'
        f'          datetime_leq: "{datetime_leq}"\n'
        f'          clientRequestHTTPHost: "{host}"\n'
        f"{eyeball_line}"
        f"{extra_filter}"
        "        }\n"
        "      ) {\n"
        "        count"
        f"{sum_block}"
        f"{avg_block}\n"
        f"        dimensions {{ {dim} }}\n"
        "      }\n"
        "    }\n"
        "  }\n"
        "}"
    )
    return cf_infinity(
        ref_id,
        dataset="httpRequestsAdaptiveGroups",
        columns=columns,
        query_body=data,
        root_selector=root_selector,
        fmt=fmt,
        computed_columns=computed_columns,
        parser=parser,
        uql=uql,
    )


def cf_firewall_events(ref_id: str, host: str) -> dict:
    data = (
        "query {\n"
        "  viewer {\n"
        '    zones(filter: { zoneTag: "${cf_zone}" }) {\n'
        "      firewallEventsAdaptive(\n"
        "        limit: 50\n"
        "        orderBy: [datetime_DESC]\n"
        "        filter: {\n"
        '          datetime_geq: "${__timeFrom:date:iso}"\n'
        '          datetime_leq: "${__timeTo:date:iso}"\n'
        f'          clientRequestHTTPHost: "{host}"\n'
        "        }\n"
        "      ) {\n"
        "        datetime\n"
        "        action\n"
        "        source\n"
        "        clientIP\n"
        "        clientCountryName\n"
        "        clientRequestPath\n"
        "        edgeResponseStatus\n"
        "        description\n"
        "      }\n"
        "    }\n"
        "  }\n"
        "}"
    )
    return cf_infinity(
        ref_id,
        dataset="firewallEventsAdaptive",
        columns=[
            {"selector": "datetime", "text": "time", "type": "timestamp"},
            {"selector": "action", "text": "action", "type": "string"},
            {"selector": "source", "text": "source", "type": "string"},
            {"selector": "clientIP", "text": "clientIP", "type": "string"},
            {"selector": "clientCountryName", "text": "country", "type": "string"},
            {"selector": "clientRequestPath", "text": "path", "type": "string"},
            {"selector": "edgeResponseStatus", "text": "status", "type": "number"},
            {"selector": "description", "text": "description", "type": "string"},
        ],
        query_body=data,
        root_selector="data.viewer.zones.0.firewallEventsAdaptive",
        fmt="table",
    )


def traffic_rate_computed_columns(bucket_seconds: int) -> list[dict]:
    """Infinity backend: req/s = requests / bucket_seconds.

    type: "number" is documentary only — Infinity backend ignores it (selector +
    text only). Panel convertFieldType (see traffic_reqps_transforms) forces
    FieldType.number after filterFieldsByName drops Adaptive count.
    """
    return [
        {
            "selector": f"requests / {bucket_seconds}",
            "text": "req/s",
            "type": "number",
        }
    ]


def traffic_ts_options() -> dict:
    """Traffic dual-query tiles: no legend (current bars + one prior line; tooltip only)."""
    return {
        "legend": {"displayMode": "list", "placement": "bottom", "showLegend": False},
        "tooltip": {"mode": "multi", "sort": "none"},
    }


def traffic_reqps_transforms() -> list[dict]:
    """Keep Time + req/s only, then force req/s to number for bars.

    Order matters: filter first (so Adaptive count cannot plot), then
    convertFieldType so string-typed Infinity computed columns become
    FieldType.number. Dual-query prior (ref B) already emits number via UQL
    tonumber; convertFieldType is a no-op when already numeric.
    """
    return [
        {
            "id": "filterFieldsByName",
            "options": {
                "include": {
                    "pattern": "^(Time|req/s)",
                }
            },
        },
        {
            "id": "convertFieldType",
            "options": {
                "conversions": [
                    {"targetField": "req/s", "destinationType": "number"},
                ]
            },
        },
    ]


def traffic_prior_period_overrides() -> list[dict]:
    """Current = green bars (ref A); prior equal window = blue dashed line (ref B)."""
    green = {"mode": "fixed", "fixedColor": "green"}
    blue = {"mode": "fixed", "fixedColor": "blue"}
    return [
        {
            "matcher": {"id": "byFrameRefID", "options": "A"},
            "properties": [
                {"id": "custom.drawStyle", "value": "bars"},
                {"id": "custom.fillOpacity", "value": 80},
                {"id": "custom.lineWidth", "value": 1},
                {"id": "color", "value": green},
                {"id": "displayName", "value": "current"},
            ],
        },
        {
            "matcher": {"id": "byFrameRefID", "options": "B"},
            "properties": [
                {"id": "custom.drawStyle", "value": "line"},
                {"id": "custom.fillOpacity", "value": 0},
                {"id": "custom.lineWidth", "value": 2},
                {
                    "id": "custom.lineStyle",
                    "value": {"fill": "dash", "dash": [5, 5]},
                },
                {"id": "custom.showPoints", "value": "never"},
                {"id": "color", "value": blue},
                {"id": "displayName", "value": "prior period"},
            ],
        },
    ]


def traffic_prior_uql(dim: str, bucket_seconds: int, prior_shift: str) -> str:
    """UQL for Query B: tonumber req/s + shift timestamps onto the current x-axis.

    Prior buckets are fetched ending at ${__timeFrom}; add_datetime(+shift) moves
    them into the panel's visible current window (same role as timeCompare
    alignment, without timeCompare frames).
    """
    return (
        "parse-json\n"
        '| jsonata "data.viewer.zones[0].httpRequestsAdaptiveGroups"\n'
        f'| extend "Time"=todatetime("dimensions.{dim}")\n'
        f'| extend "Time"=add_datetime("Time",\'{prior_shift}\')\n'
        '| extend "requests"=tonumber("count")\n'
        f'| extend "req/s"=div("requests",{bucket_seconds})\n'
        '| project "Time", "req/s"'
    )


def traffic_prior_target(host: str, win: dict) -> dict:
    """Infinity Query B: prior equal window via shifted time bounds + UQL align.

    Infinity macros have no date arithmetic, so prior is fetched as the newest
    `prior_buckets` Adaptive groups with datetime_leq=${__timeFrom:date:iso}
    (prior ends where current starts) and a loose datetime_geq (start of that
    calendar month, stays under CF Free ~30d). orderBy DESC + limit selects the
    prior equal window; UQL shifts timestamps forward by prior_shift for overlay.
    """
    dim = win["dim"]
    prior_shift = win["prior_shift"]
    prior_buckets = win["prior_buckets"]
    bucket_seconds = win["bucket_seconds"]
    order_by_desc = win["order_by"].replace("_ASC", "_DESC")
    # Start of calendar month of __timeFrom — early enough for hour/day/week
    # lookbacks; month prior may be partial near the 1st (CF Free edge).
    prior_geq = "${__timeFrom:date:YYYY-MM}-01T00:00:00.000Z"
    return cf_graphql(
        "B",
        host,
        dim,
        order_by_desc,
        columns=[],  # UQL projects Time + req/s
        limit=prior_buckets,
        datetime_geq=prior_geq,
        datetime_leq="${__timeFrom:date:iso}",
        parser="uql",
        uql=traffic_prior_uql(dim, bucket_seconds, prior_shift),
        root_selector="",
    )


def traffic_panel(panel_id: int, cfg: dict, win: dict, grid_pos: dict) -> dict:
    host, cf_name = cfg["host"], cfg["cf_name"]
    title, time_from = win["title"], win["time_from"]
    if win["source"] == "cw":
        # Last year: no YoY / prior-period overlay (Grafana Free retention + skip YoY).
        return {
            "id": panel_id,
            "type": "timeseries",
            "title": title,
            "description": (
                f"CloudFront request rate ({cf_name}) via CloudWatch scrape → Prometheus "
                "(PromQL rate → req/s). Grafana Cloud Free retains metrics for 14 days "
                "only — a full year needs a native CloudWatch data source or Pro "
                "retention (not scrape-to-Prom). No year-over-year compare."
            ),
            "gridPos": grid_pos,
            "timeFrom": time_from,
            "datasource": {"type": "prometheus", "uid": "${datasource}"},
            "fieldConfig": ts_field("reqps", bars=True),
            "options": ts_options(),
            "targets": [
                {
                    "refId": "A",
                    "expr": (
                        f'sum(rate(aws_cloudfront_requests_sum{{project="block-drop", '
                        f'Name="{cf_name}"}}[1h]))'
                    ),
                    "legendFormat": "req/s",
                }
            ],
        }
    dim, order_by = win["dim"], win["order_by"]
    bucket_seconds = win["bucket_seconds"]
    prior_shift = win["prior_shift"]
    field = ts_field("reqps", bars=True)
    field["overrides"] = traffic_prior_period_overrides()
    return {
        "id": panel_id,
        "type": "timeseries",
        "title": title,
        "description": (
            f"Cloudflare edge request rate ({host}), fixed range {time_from}. "
            f"req/s = Adaptive count / {bucket_seconds} ({dim} bucket). "
            "Two Infinity queries (no timeCompare): A = current "
            "${__timeFrom}/${__timeTo}; B = prior equal window "
            f"(datetime_leq=${{__timeFrom}}, limit+orderBy DESC, UQL "
            f"add_datetime(+{prior_shift}) for overlay + tonumber). "
            "Bars = current (A); dashed line = prior (B). "
            "filterFieldsByName keeps Time + req/s only; convertFieldType "
            "forces number for bars (Infinity backend ignores computed_columns.type)."
        ),
        "gridPos": grid_pos,
        "timeFrom": time_from,
        "datasource": {"type": "yesoreyeram-infinity-datasource", "uid": "${infinity}"},
        "fieldConfig": field,
        "options": traffic_ts_options(),
        "transformations": traffic_reqps_transforms(),
        "targets": [
            cf_graphql(
                "A",
                host,
                dim,
                order_by,
                [
                    {"selector": f"dimensions.{dim}", "text": "Time", "type": "timestamp"},
                    {"selector": "count", "text": "requests", "type": "number"},
                ],
                computed_columns=traffic_rate_computed_columns(bucket_seconds),
            ),
            traffic_prior_target(host, win),
        ],
    }


def error_series_colors() -> list[dict]:
    """4xx = yellow (ref A), 5xx = red (ref B).

    Infinity timeseries frames often expose a generic value field name, so name/regexp
    matchers miss; byFrameRefID matches the query targets reliably. byName covers the
    CloudWatch year panel legend formats as a fallback.
    """
    yellow = {"mode": "fixed", "fixedColor": "yellow"}
    red = {"mode": "fixed", "fixedColor": "red"}
    return [
        {
            "matcher": {"id": "byFrameRefID", "options": "A"},
            "properties": [{"id": "color", "value": yellow}],
        },
        {
            "matcher": {"id": "byFrameRefID", "options": "B"},
            "properties": [{"id": "color", "value": red}],
        },
        {
            "matcher": {"id": "byName", "options": "4xx"},
            "properties": [{"id": "color", "value": yellow}],
        },
        {
            "matcher": {"id": "byName", "options": "4xx %"},
            "properties": [{"id": "color", "value": yellow}],
        },
        {
            "matcher": {"id": "byName", "options": "5xx"},
            "properties": [{"id": "color", "value": red}],
        },
        {
            "matcher": {"id": "byName", "options": "5xx %"},
            "properties": [{"id": "color", "value": red}],
        },
    ]


def errors_panel(panel_id: int, cfg: dict, win: dict, grid_pos: dict) -> dict:
    host, cf_name = cfg["host"], cfg["cf_name"]
    title, time_from = win["title"], win["time_from"]
    if win["source"] == "cw":
        field = ts_field("percent", bars=True)
        field["overrides"] = error_series_colors()
        return {
            "id": panel_id,
            "type": "timeseries",
            "title": title,
            "description": (
                f"CloudFront 4xx/5xx error rates ({cf_name}) via CloudWatch scrape → "
                "Prometheus (rates %, not counts). Grafana Cloud Free metrics retention "
                "is 14 days — year history needs native CloudWatch DS or Pro."
            ),
            "gridPos": grid_pos,
            "timeFrom": time_from,
            "datasource": {"type": "prometheus", "uid": "${datasource}"},
            "fieldConfig": field,
            "options": ts_options(),
            "targets": [
                {
                    "refId": "A",
                    "expr": (
                        f'avg(aws_cloudfront_4xx_error_rate_average{{project="block-drop", '
                        f'Name="{cf_name}"}})'
                    ),
                    "legendFormat": "4xx %",
                },
                {
                    "refId": "B",
                    "expr": (
                        f'avg(aws_cloudfront_5xx_error_rate_average{{project="block-drop", '
                        f'Name="{cf_name}"}})'
                    ),
                    "legendFormat": "5xx %",
                },
            ],
        }

    dim, order_by = win["dim"], win["order_by"]

    def cols(label: str) -> list[dict]:
        return [
            {"selector": f"dimensions.{dim}", "text": "Time", "type": "timestamp"},
            {"selector": "count", "text": label, "type": "number"},
        ]

    field = ts_field(bars=True)
    field["overrides"] = error_series_colors()
    return {
        "id": panel_id,
        "type": "timeseries",
        "title": title,
        "description": f"Cloudflare edge 4xx and 5xx counts ({host}), fixed range {time_from}.",
        "gridPos": grid_pos,
        "timeFrom": time_from,
        "datasource": {"type": "yesoreyeram-infinity-datasource", "uid": "${infinity}"},
        "fieldConfig": field,
        "options": ts_options(),
        "targets": [
            cf_graphql(
                "A",
                host,
                dim,
                order_by,
                cols("4xx"),
                extra_filter=(
                    "          edgeResponseStatus_geq: 400\n"
                    "          edgeResponseStatus_leq: 499\n"
                ),
            ),
            cf_graphql(
                "B",
                host,
                dim,
                order_by,
                cols("5xx"),
                extra_filter=(
                    "          edgeResponseStatus_geq: 500\n"
                    "          edgeResponseStatus_leq: 599\n"
                ),
            ),
        ],
    }


def latency_panel(panel_id: int, cfg: dict, win: dict, grid_pos: dict) -> dict:
    """CloudFront OriginLatency + Cloudflare originResponseDurationMs (Free has no edge TTFB)."""
    host, cf_name = cfg["host"], cfg["cf_name"]
    title, time_from = win["title"], win["time_from"]
    origin_target = {
        "refId": "A",
        "datasource": {"type": "prometheus", "uid": "${datasource}"},
        "expr": (
            f'avg(aws_cloudfront_origin_latency_average{{project="block-drop", '
            f'Name="{cf_name}"}})'
        ),
        "legendFormat": "CF OriginLatency",
    }

    if win["source"] == "cw":
        return {
            "id": panel_id,
            "type": "timeseries",
            "title": title,
            "description": (
                f"CloudFront OriginLatency ({cf_name}) via CloudWatch scrape → Prometheus. "
                "Grafana Cloud Free retains metrics 14 days; year history needs native "
                "CloudWatch DS or Pro. CF Free has no edge TTFB."
            ),
            "gridPos": grid_pos,
            "timeFrom": time_from,
            "datasource": {"type": "prometheus", "uid": "${datasource}"},
            "fieldConfig": ts_field("ms", bars=True),
            "options": ts_options(),
            "targets": [origin_target],
        }

    dim, order_by = win["dim"], win["order_by"]
    return {
        "id": panel_id,
        "type": "timeseries",
        "title": title,
        "description": (
            f"CloudFront OriginLatency ({cf_name}) and Cloudflare "
            f"avg.originResponseDurationMs ({host}). Free plan does not expose edge TTFB."
        ),
        "gridPos": grid_pos,
        "timeFrom": time_from,
        "datasource": {"type": "datasource", "uid": "-- Mixed --"},
        "fieldConfig": ts_field("ms", bars=True),
        "options": ts_options(),
        "targets": [
            origin_target,
            {
                **cf_graphql(
                    "B",
                    host,
                    dim,
                    order_by,
                    [
                        {
                            "selector": f"dimensions.{dim}",
                            "text": "Time",
                            "type": "timestamp",
                        },
                        {
                            "selector": "avg.originResponseDurationMs",
                            "text": "CF origin duration",
                            "type": "number",
                        },
                    ],
                    avg_fields=["originResponseDurationMs"],
                ),
                "datasource": {
                    "type": "yesoreyeram-infinity-datasource",
                    "uid": "${infinity}",
                },
            },
        ],
    }


def build_dashboard(env_key: str) -> dict:
    cfg = ENVS[env_key]
    env = cfg["environment"]
    host = cfg["host"]
    job = cfg["probe_job"]
    cf_name = cfg["cf_name"]
    next_id = 1
    panels: list[dict] = []
    y = 0

    def nid() -> int:
        nonlocal next_id
        i = next_id
        next_id += 1
        return i

    panels.append(
        row(
            nid(),
            "Traffic — req/s + prior equal window (CF ≤30d; year = CloudWatch, no YoY)",
            y,
        )
    )
    y += 1
    for i, win in enumerate(WINDOWS):
        panels.append(traffic_panel(nid(), cfg, win, metric_grid_pos(i, y)))
    y += metric_section_height()

    panels.append(
        row(nid(), "Errors — 4xx / 5xx (CF counts ≤30d; year = CloudWatch rates)", y)
    )
    y += 1
    for i, win in enumerate(WINDOWS):
        panels.append(errors_panel(nid(), cfg, win, metric_grid_pos(i, y)))
    y += metric_section_height()

    panels.append(
        row(
            nid(),
            "Latency — CF OriginLatency + CF origin duration (no Free edge TTFB)",
            y,
        )
    )
    y += 1
    for i, win in enumerate(WINDOWS):
        panels.append(latency_panel(nid(), cfg, win, metric_grid_pos(i, y)))
    y += metric_section_height()

    panels.append(row(nid(), "Synthetics — availability", y))
    y += 1
    # Same tile size as traffic/errors/latency (h=4, w=8; 3 per row).
    # Block Drop also probes /api/scores (in addition to the site).
    scores_job = cfg["probe_job_scores"]

    def uptime_stat(title: str, probe_job: str, grid_idx: int) -> dict:
        return {
            "id": nid(),
            "type": "stat",
            "title": title,
            "description": f"Average probe_success for {probe_job}",
            "gridPos": metric_grid_pos(grid_idx, y),
            "datasource": {"type": "prometheus", "uid": "${datasource}"},
            "fieldConfig": {
                "defaults": {
                    "unit": "percentunit",
                    "min": 0,
                    "max": 1,
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {"color": "red", "value": None},
                            {"color": "yellow", "value": 0.95},
                            {"color": "green", "value": 0.99},
                        ],
                    },
                },
                "overrides": [],
            },
            "options": {
                "reduceOptions": {"calcs": ["mean"], "fields": "", "values": False},
                "colorMode": "background",
                "graphMode": "none",
                "textMode": "value_and_name",
            },
            "targets": [
                {
                    "refId": "A",
                    "expr": f'avg(probe_success{{project="block-drop", job="{probe_job}"}})',
                    "legendFormat": "uptime",
                }
            ],
        }

    panels.append(uptime_stat(f"{env} site", job, 0))
    panels.append(uptime_stat(f"{env} /api/scores", scores_job, 1))

    synth_charts = [
        (
            2,
            "Probe success",
            f'probe_success{{project="block-drop", environment="{env}"}}',
            "short",
            "{{job}} / {{probe}}",
            None,
        ),
        (
            3,
            "Probe duration",
            f'probe_duration_seconds{{project="block-drop", environment="{env}"}}',
            "s",
            "{{job}} / {{probe}}",
            None,
        ),
        (
            4,
            "HTTP status code",
            f'probe_http_status_code{{project="block-drop", environment="{env}"}}',
            "short",
            "{{job}} / {{probe}}",
            None,
        ),
        (
            5,
            "HTTP phase latency",
            (
                f'avg by (phase) (probe_http_duration_seconds{{project="block-drop", '
                f'environment="{env}"}})'
            ),
            "s",
            "{{phase}}",
            {"mode": "normal", "group": "A"},
        ),
    ]
    for idx, title, expr, unit, legend, stacking in synth_charts:
        defaults: dict = {
            "unit": unit,
            "custom": {
                "drawStyle": "line",
                "lineWidth": 2,
                "fillOpacity": 10,
                "spanNulls": False,
                "showPoints": "never" if stacking else "auto",
            },
        }
        if stacking:
            defaults["custom"]["stacking"] = stacking
        if "success" in title.lower():
            defaults["min"] = 0
            defaults["max"] = 1
        panels.append(
            {
                "id": nid(),
                "type": "timeseries",
                "title": title,
                **(
                    {"description": "DNS / connect / TLS / processing / transfer"}
                    if title == "HTTP phase latency"
                    else {}
                ),
                "gridPos": metric_grid_pos(idx, y),
                "datasource": {"type": "prometheus", "uid": "${datasource}"},
                "fieldConfig": {"defaults": defaults, "overrides": []},
                "options": ts_options(),
                "targets": [{"refId": "A", "expr": expr, "legendFormat": legend}],
            }
        )
    panels.append(
        {
            "id": nid(),
            "type": "logs",
            "title": "Synthetic check logs",
            "description": "Loki logs from Synthetic Monitoring agents for this environment",
            "gridPos": metric_grid_pos(6, y),
            "datasource": {"type": "loki", "uid": "${loki}"},
            "options": {
                "showTime": True,
                "showLabels": True,
                "showCommonLabels": False,
                "wrapLogMessage": True,
                "prettifyLogMessage": False,
                "enableLogDetails": True,
                "dedupStrategy": "none",
                "sortOrder": "Descending",
            },
            "targets": [
                {
                    "refId": "A",
                    "expr": (
                        f'{{source="synthetic-monitoring-agent", project="block-drop", '
                        f'environment="{env}"}}'
                    ),
                    "queryType": "range",
                }
            ],
        }
    )
    # 7 tiles (2 stats + 4 charts + logs) → 3 rows at h=4
    y += METRIC_PANEL_H * 3

    # --- Cloudflare (items 1–8): volume, cache/status/bots, paths/geo/firewall ---
    # Uses dashboard time range; keep ≤ ~30d on Free Adaptive Analytics.
    infinity_ds = {"type": "yesoreyeram-infinity-datasource", "uid": "${infinity}"}

    panels.append(row(nid(), "Cloudflare — volume", y))
    y += 1
    # 1 Bandwidth
    panels.append(
        {
            "id": nid(),
            "type": "timeseries",
            "title": "Bandwidth",
            "description": f"sum.edgeResponseBytes for {host} (eyeball traffic).",
            "gridPos": metric_grid_pos(0, y),
            "datasource": infinity_ds,
            "fieldConfig": ts_field("decbytes", bars=True),
            "options": ts_options(),
            "targets": [
                cf_graphql(
                    "A",
                    host,
                    "datetimeHour",
                    "datetimeHour_ASC",
                    [
                        {
                            "selector": "dimensions.datetimeHour",
                            "text": "Time",
                            "type": "timestamp",
                        },
                        {
                            "selector": "sum.edgeResponseBytes",
                            "text": "bytes",
                            "type": "number",
                        },
                    ],
                    sum_fields=["edgeResponseBytes"],
                    eyeball=True,
                )
            ],
        }
    )
    # 6 Visits
    panels.append(
        {
            "id": nid(),
            "type": "timeseries",
            "title": "Visits",
            "description": (
                f"sum.visits for {host} (Cloudflare visit = page view with external/direct referrer)."
            ),
            "gridPos": metric_grid_pos(1, y),
            "datasource": infinity_ds,
            "fieldConfig": ts_field(bars=True),
            "options": ts_options(),
            "targets": [
                cf_graphql(
                    "A",
                    host,
                    "datetimeHour",
                    "datetimeHour_ASC",
                    [
                        {
                            "selector": "dimensions.datetimeHour",
                            "text": "Time",
                            "type": "timestamp",
                        },
                        {"selector": "sum.visits", "text": "visits", "type": "number"},
                    ],
                    sum_fields=["visits"],
                    eyeball=True,
                )
            ],
        }
    )
    # 3 Status mix
    panels.append(
        {
            "id": nid(),
            "type": "table",
            "title": "Status mix",
            "description": f"edgeResponseStatus totals for {host} in the dashboard range.",
            "gridPos": metric_grid_pos(2, y),
            "datasource": infinity_ds,
            "options": {"showHeader": True},
            "fieldConfig": {"defaults": {}, "overrides": []},
            "targets": [
                cf_graphql(
                    "A",
                    host,
                    "edgeResponseStatus",
                    "count_DESC",
                    [
                        {
                            "selector": "dimensions.edgeResponseStatus",
                            "text": "status",
                            "type": "number",
                        },
                        {"selector": "count", "text": "requests", "type": "number"},
                    ],
                    limit=30,
                    fmt="table",
                    eyeball=True,
                )
            ],
        }
    )
    y += METRIC_PANEL_H

    panels.append(row(nid(), "Cloudflare — cache & bots", y))
    y += 1
    # 2 Cache status
    panels.append(
        {
            "id": nid(),
            "type": "table",
            "title": "Cache status",
            "description": f"cacheStatus breakdown for {host} (HIT/MISS/EXPIRED/…).",
            "gridPos": metric_grid_pos(0, y),
            "datasource": infinity_ds,
            "options": {"showHeader": True},
            "fieldConfig": {"defaults": {}, "overrides": []},
            "targets": [
                cf_graphql(
                    "A",
                    host,
                    "cacheStatus",
                    "count_DESC",
                    [
                        {
                            "selector": "dimensions.cacheStatus",
                            "text": "cache",
                            "type": "string",
                        },
                        {"selector": "count", "text": "requests", "type": "number"},
                        {
                            "selector": "sum.edgeResponseBytes",
                            "text": "bytes",
                            "type": "number",
                        },
                    ],
                    sum_fields=["edgeResponseBytes"],
                    limit=20,
                    fmt="table",
                    eyeball=True,
                )
            ],
        }
    )
    # 8 Bot categories
    panels.append(
        {
            "id": nid(),
            "type": "table",
            "title": "Verified bots",
            "description": f"verifiedBotCategory for {host} (empty = unverified / human-ish).",
            "gridPos": metric_grid_pos(1, y),
            "datasource": infinity_ds,
            "options": {"showHeader": True},
            "fieldConfig": {"defaults": {}, "overrides": []},
            "targets": [
                cf_graphql(
                    "A",
                    host,
                    "verifiedBotCategory",
                    "count_DESC",
                    [
                        {
                            "selector": "dimensions.verifiedBotCategory",
                            "text": "bot category",
                            "type": "string",
                        },
                        {"selector": "count", "text": "requests", "type": "number"},
                    ],
                    limit=20,
                    fmt="table",
                    eyeball=False,
                )
            ],
        }
    )
    # 5 Geography (compact)
    panels.append(
        {
            "id": nid(),
            "type": "table",
            "title": "Countries",
            "description": f"Top clientCountryName for {host}.",
            "gridPos": metric_grid_pos(2, y),
            "datasource": infinity_ds,
            "options": {"showHeader": True},
            "fieldConfig": {"defaults": {}, "overrides": []},
            "targets": [
                cf_graphql(
                    "A",
                    host,
                    "clientCountryName",
                    "count_DESC",
                    [
                        {
                            "selector": "dimensions.clientCountryName",
                            "text": "country",
                            "type": "string",
                        },
                        {"selector": "count", "text": "requests", "type": "number"},
                    ],
                    limit=15,
                    fmt="table",
                    eyeball=True,
                )
            ],
        }
    )
    y += METRIC_PANEL_H

    panels.append(row(nid(), "Cloudflare — paths & firewall", y))
    y += 1
    # 4 Top paths (taller)
    panels.append(
        {
            "id": nid(),
            "type": "table",
            "title": "Top paths",
            "description": f"Top clientRequestPath + method for {host}.",
            "gridPos": {
                "h": METRIC_PANEL_H * 2,
                "w": METRIC_PANEL_W,
                "x": 0,
                "y": y,
            },
            "datasource": infinity_ds,
            "options": {"showHeader": True},
            "fieldConfig": {"defaults": {}, "overrides": []},
            "targets": [
                cf_graphql(
                    "A",
                    host,
                    "clientRequestPath clientRequestHTTPMethodName",
                    "count_DESC",
                    [
                        {
                            "selector": "dimensions.clientRequestHTTPMethodName",
                            "text": "method",
                            "type": "string",
                        },
                        {
                            "selector": "dimensions.clientRequestPath",
                            "text": "path",
                            "type": "string",
                        },
                        {"selector": "count", "text": "requests", "type": "number"},
                        {
                            "selector": "sum.edgeResponseBytes",
                            "text": "bytes",
                            "type": "number",
                        },
                    ],
                    sum_fields=["edgeResponseBytes"],
                    limit=25,
                    fmt="table",
                    eyeball=True,
                )
            ],
        }
    )
    # 7 Firewall events (taller, double width for columns)
    panels.append(
        {
            "id": nid(),
            "type": "table",
            "title": "Firewall events",
            "description": (
                f"firewallEventsAdaptive for {host} (may be empty when no WAF/firewall matches). "
                "Free plan: event rows only; aggregated firewall groups are unavailable."
            ),
            "gridPos": {
                "h": METRIC_PANEL_H * 2,
                "w": METRIC_PANEL_W * 2,
                "x": METRIC_PANEL_W,
                "y": y,
            },
            "datasource": infinity_ds,
            "options": {"showHeader": True},
            "fieldConfig": {"defaults": {}, "overrides": []},
            "targets": [cf_firewall_events("A", host)],
        }
    )
    y += METRIC_PANEL_H * 2

    panels.append(row(nid(), "GitHub Actions CI", y))
    y += 1
    for title, workflow, h, x, yy in [
        ("Deploy workflow runs", "deploy-block-drop.yml", 8, 0, y),
        ("Terraform plan workflow runs", "terraform-plan.yml", 8, 12, y),
        ("Deploy workflow usage", "deploy-block-drop.yml", 6, 0, y + 8),
        ("Terraform plan workflow usage", "terraform-plan.yml", 6, 12, y + 8),
    ]:
        qtype = "Workflow_Usage" if "usage" in title.lower() else "Workflow_Runs"
        panels.append(
            {
                "id": nid(),
                "type": "table",
                "title": title,
                "description": f"{qtype} for {workflow}.",
                "gridPos": {"h": h, "w": 12, "x": x, "y": yy},
                "datasource": {"type": "grafana-github-datasource", "uid": "${github}"},
                "options": {"showHeader": True},
                # grafana-github-datasource reads workflow from options.workflow
                # (top-level "workflow" is ignored → empty → "workflow not found").
                "targets": [
                    {
                        "refId": "A",
                        "queryType": qtype,
                        "owner": "$gh_owner",
                        "repository": "$gh_repo",
                        "options": {"workflow": workflow},
                    }
                ],
            }
        )

    return {
        "uid": cfg["uid"],
        "title": cfg["title"],
        "description": (
            f"Block Drop {env}: fixed-window traffic / errors / latency, synthetics, "
            "Cloudflare edge, and GitHub Actions."
        ),
        "tags": ["block-drop", env, "synthetics", "observability", "cloudflare", "github"],
        "timezone": "browser",
        "schemaVersion": 39,
        "version": 2,
        "refresh": "1m",
        "time": {"from": "now-6h", "to": "now"},
        "templating": {
            "list": [
                {
                    "name": "datasource",
                    "type": "datasource",
                    "query": "prometheus",
                    "current": {},
                    "hide": 0,
                    "includeAll": False,
                    "multi": False,
                    "refresh": 1,
                    "regex": "",
                    "skipUrlSync": False,
                },
                {
                    "name": "loki",
                    "type": "datasource",
                    "query": "loki",
                    "current": {},
                    "hide": 0,
                    "includeAll": False,
                    "multi": False,
                    "refresh": 1,
                    "regex": "",
                    "skipUrlSync": False,
                },
                {
                    "name": "infinity",
                    "type": "datasource",
                    "query": "yesoreyeram-infinity-datasource",
                    "current": {
                        "text": "Cloudflare GraphQL",
                        "value": "infinity-cloudflare",
                    },
                    "hide": 0,
                    "includeAll": False,
                    "multi": False,
                    "refresh": 1,
                    "regex": "",
                    "skipUrlSync": False,
                },
                {
                    "name": "github",
                    "type": "datasource",
                    "query": "grafana-github-datasource",
                    "current": {
                        "text": "GitHub Block Drop",
                        "value": "github-block-drop",
                    },
                    "hide": 0,
                    "includeAll": False,
                    "multi": False,
                    "refresh": 1,
                    "regex": "",
                    "skipUrlSync": False,
                },
                {
                    "name": "cf_zone",
                    "type": "textbox",
                    "label": "CF zoneTag",
                    "query": "",
                    "current": {"text": "", "value": ""},
                    "hide": 0,
                    "skipUrlSync": False,
                    "description": "Cloudflare zone id (terraform cloudflare output zone_id).",
                },
                {
                    "name": "gh_owner",
                    "type": "textbox",
                    "query": "7oas7er",
                    "current": {"text": "7oas7er", "value": "7oas7er"},
                    "hide": 2,
                },
                {
                    "name": "gh_repo",
                    "type": "textbox",
                    "query": "block-drop",
                    "current": {"text": "block-drop", "value": "block-drop"},
                    "hide": 2,
                },
            ]
        },
        "annotations": {
            "list": [
                {
                    "name": "GitHub commits",
                    "datasource": {
                        "type": "grafana-github-datasource",
                        "uid": "${github}",
                    },
                    "enable": True,
                    "iconColor": "blue",
                    "target": {
                        "refId": "Anno",
                        "queryType": "Commits",
                        "owner": "$gh_owner",
                        "repository": "$gh_repo",
                    },
                }
            ]
        },
        "panels": panels,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for key in ("prod", "stg"):
        dash = build_dashboard(key)
        path = OUT_DIR / f"block-drop-{key}.json"
        path.write_text(json.dumps(dash, indent=2) + "\n")
        print(f"wrote {path} ({len(dash['panels'])} panels)")


if __name__ == "__main__":
    main()
