\set ON_ERROR_STOP on
\getenv vault_name ZINERGIA_VAULT_NAME
\getenv vault_value ZINERGIA_VAULT_VALUE
\getenv vault_description ZINERGIA_VAULT_DESCRIPTION

WITH updated AS (
    SELECT vault.update_secret(
        id,
        :'vault_value',
        :'vault_name',
        :'vault_description'
    )
    FROM vault.secrets
    WHERE name = :'vault_name'
), created AS (
    SELECT vault.create_secret(
        :'vault_value',
        :'vault_name',
        :'vault_description'
    )
    WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = :'vault_name')
)
SELECT 'ok'
FROM (SELECT count(*) FROM updated) AS did_update
CROSS JOIN (SELECT count(*) FROM created) AS did_create;
