-- Mission Control spend export in Amazon Athena.
--
-- `/tokens export [period]` writes a FinOps FOCUS-style CSV to ~/Downloads, e.g.
-- mission-control-spend-2026-10-01-2026-10-31.csv. Copy the files into one S3 prefix
-- (below: s3://YOUR-BUCKET/mission-control-spend/) and run these in Athena.
--
-- The columns:
--   ChargePeriodStart / ChargePeriodEnd  one local day, midnight to the next midnight,
--                                        ISO 8601 with its UTC offset (2026-10-20T00:00:00+08:00)
--   BilledCost        estimated US dollars (list prices; not an invoice)
--   PricingCurrency   always USD
--   ResourceName      the model (claude-opus-5-5)
--   ConsumedQuantity  tokens: input + output + cache reads + cache writes
--   ConsumedUnit      always tokens
--   x_Project         Claude Code's project folder (the project path with / turned into -)
-- A line with ResourceName "unattributed" is spend the ledger holds for a day whose
-- transcripts Claude Code has since deleted (it keeps them 30 days by default).

CREATE DATABASE IF NOT EXISTS finops;

-- Every column is a string (OpenCSVSerDe reads nothing else); the query casts them.
-- The header line of each file is skipped.
CREATE EXTERNAL TABLE IF NOT EXISTS finops.mission_control_spend (
  chargeperiodstart string,
  chargeperiodend   string,
  billedcost        string,
  pricingcurrency   string,
  resourcename      string,
  consumedquantity  string,
  consumedunit      string,
  x_project         string
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
WITH SERDEPROPERTIES (
  'separatorChar' = ',',
  'quoteChar'     = '"',
  'escapeChar'    = '\\'
)
STORED AS TEXTFILE
LOCATION 's3://YOUR-BUCKET/mission-control-spend/'
TBLPROPERTIES ('skip.header.line.count' = '1');

-- Cost and tokens per calendar month, by model. The month is the first 7 characters of
-- ChargePeriodStart, so it is the month on the clock where the work was done.
-- If you export overlapping periods, keep one file per day range (or dedupe on the
-- start, model and project columns) so a day is not counted twice.
SELECT
  substr(chargeperiodstart, 1, 7)          AS month,
  resourcename                             AS model,
  round(sum(cast(billedcost AS double)), 2) AS cost_usd,
  sum(cast(consumedquantity AS bigint))    AS tokens
FROM finops.mission_control_spend
GROUP BY 1, 2
ORDER BY 1 DESC, cost_usd DESC;

-- The same by project, for one month.
SELECT
  x_project                                 AS project,
  round(sum(cast(billedcost AS double)), 2) AS cost_usd,
  sum(cast(consumedquantity AS bigint))     AS tokens
FROM finops.mission_control_spend
WHERE substr(chargeperiodstart, 1, 7) = '2026-10'
GROUP BY 1
ORDER BY cost_usd DESC;
