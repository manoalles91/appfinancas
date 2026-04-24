import re
from datetime import datetime

data_raw = """2026-03-26,Panificadora Progress,8.05
2026-03-25,Amazon,52.14
2026-03-25,Amazon,104.32
2026-03-25,Gulas Pizzaria Sh,129.50
2026-03-25,Casarano Delivery,120.00
2026-03-25,Mercado*Mercadolivre,95.40
2026-03-25,Google One,24.99
2026-03-24,Panificadora Progress,38.14
2026-03-19,Jhow Black Lanches,43.98
2026-03-17,Mercadolivre*Hmeautop,243.63
2026-03-16,Pop Pizzaria,119.00
2026-03-16,Adriano Jose Iseppi,72.00
2026-03-16,Farmacia Real,45.55
2026-03-14,Adiqplu*Panificadora P,74.52
2026-03-13,Posto do Lago,21.47
2026-03-12,Parana Bicicletaria,89.90
2026-03-10,Ebn *Hostinger,89.99
2026-03-10,Mercadolivre*Megashopm,139.35
2026-03-09,Bendito Gastrobar,96.00
2026-03-09,Casa das Plantas,85.00
2026-03-08,Panificadora Progress,36.55
2026-03-08,Pontocerto Santa Helen,114.00
2026-03-07,Gulas Pizzaria Sh,121.50
2026-03-06,Pagamento recebido,-107.77
2026-03-06,IOF de compra internacional,1.81
2026-03-06,Suno Inc.,51.98
2026-03-04,Guedes Acai,21.39
2026-03-04,Mercado*Melhorenvio,33.05
2026-03-03,Amazon - Parcela 3/4,35.55
2026-03-03,Mercadolivre*Gigantec - Parcela 7/10,50.45
2026-03-03,Amazon Marketplace Cc - Parcela 4/6,54.36
2026-03-03,Pp *Decorise Deco - Parcela 10/12,359.75
2026-03-03,Mlp *Kabum-Kabum - Parcela 7/10,114.42
2026-03-03,Brasil Paral*Brasilpar - Parcela 2/10,12.00
2026-03-03,Mercadolivre*12produt - Parcela 7/11,59.44
2026-03-03,Mercadolivre*Mercadol - Parcela 2/12,268.35
2026-03-03,Mercadolivre*Mercadol - Parcela 2/8,50.38
2026-03-03,Midea Com - Parcela 7/12,305.00
2026-03-03,Pg *Alegra-Te Quadros - Parcela 2/12,42.98"""

sql_vals = []

def add_m(d, m_count):
    m = d.month - 1 + m_count
    y = d.year + m // 12
    m = m % 12 + 1
    d_out = min(d.day, [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m-1])
    return d.replace(year=y, month=m, day=d_out)

for line in data_raw.strip().split('\n'):
    ps = line.split(',')
    dt_s, tit, amt = ps[0], ps[1], float(ps[2])
    bd = datetime.strptime(dt_s, "%Y-%m-%d")
    
    m = re.search(r'Parcela (\d+)/(\d+)', tit)
    if m:
        curr, total = int(m.group(1)), int(m.group(2))
        base_t = tit.split(' - Parcela')[0].replace("'", "''")
        for p in range(curr, total + 1):
            pd = add_m(bd, p - curr)
            sql_vals.append("('{}', '{} - Parcela {}/{}', {}, 'credit', 'Compras', 'Nubank', '{}/{}')".format(
                pd.strftime('%Y-%m-%d'), base_t, p, total, amt, p, total))
    else:
        tt = 'income' if amt < 0 else 'credit'
        tit_esc = tit.replace("'", "''")
        sql_vals.append("('{}', '{}', {}, '{}', 'Diversos', 'Nubank', NULL)".format(
            dt_s, tit_esc, abs(amt), tt))

print("DELETE FROM transactions WHERE card_name = 'Nubank';")
print("INSERT INTO transactions (date, description, amount, type, category, card_name, installment_info) VALUES")
print(",\n".join(sql_vals) + ";")
