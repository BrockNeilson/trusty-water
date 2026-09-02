# Accounts

An account owns the deals and the plan for realising value from what those deals sold.
`data/accounts/<slug>.json` holds it: outcomes, products, pipeline, plan, economics and the
steps you walk through.

```bash
node bin/dealmap.mjs account list
node bin/dealmap.mjs account check northwind
node bin/dealmap.mjs account build northwind --brand brex
```

## The usage feed

Adoption and outcome numbers go stale the moment you type them, so they come in from wherever
the data already lives. The feed is deliberately tool-agnostic — four columns any BI tool can
export:

```csv
kind,id,field,value
product,expense,active,816
product,expense,licensed,2400
outcome,close,current,7
outcome,spend,current,780000
```

```bash
node bin/dealmap.mjs usage northwind --file ~/Downloads/northwind-week38.csv --dry-run
node bin/dealmap.mjs usage northwind --file ~/Downloads/northwind-week38.csv --source "Snowflake"
```

`kind` is `product` or `outcome`. `field` is `licensed`/`active` for a product, and
`current`/`baseline`/`target` for an outcome. Rows naming an id the account does not have are
reported and skipped rather than silently creating one. A JSON array of the same row objects
works too.

**Getting that file out of your stack:** a Domo or Tableau scheduled export, a Snowflake task
writing to a stage, or `snowsql -q "..." -o output_format=csv` in a cron job — anything that can
write those four columns on a cadence.

## Why there is no live connector

A published plan is a static page. A live connection to Domo, Tableau or Snowflake needs
credentials and a server to hold them — a page cannot keep a secret, and the hosted plan runs in
the viewer's browser. So the seam is the feed above: your warehouse writes rows, `dealmap usage`
applies them, and the change lands in git where you can see what moved between reviews.

If a live connection is worth building later, the shape it should take is a small service that
owns the credentials, runs the query on a schedule, and writes the same four-column feed. Nothing
above it changes.
