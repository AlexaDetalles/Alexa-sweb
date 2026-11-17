#!/usr/bin/env python3
"""Genera el libro de Excel / Google Sheets de finanzas de Alexa Detalles con los datos de hoy.

  FINANZAS_TOKEN='…' python3 herramientas/excel-finanzas.py [salida.xlsx]

Pestañas de DATOS (Productos, Movimientos, Gastos, Deudas, Lotes): copia de lo que hay en la tienda, con formato.
Pestaña PANEL: todas las cuentas y los gráficos son FÓRMULAS sobre esas pestañas, así que se recalculan solas
cuando los datos cambian (herramientas/hoja-google.gs los refresca cada minuto en Google Sheets).
Las columnas tienen que coincidir con las hojas CSV del Worker (worker/finanzas.js).
"""
import csv, io, os, sys, urllib.request
from openpyxl import Workbook
from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

BASE = os.environ.get('SITIO', 'https://alexashop.cc')
TOKEN = os.environ.get('FINANZAS_TOKEN')
SALIDA = sys.argv[1] if len(sys.argv) > 1 else 'finanzas-alexa.xlsx'
if not TOKEN:
    sys.exit('Falta FINANZAS_TOKEN (el secreto del Worker).')

VINO, VINO_CLARO, CREMA, ORO = '7A2E3A', 'F3E6E4', 'FBF7F2', 'C9A24B'
MONEDA = '"L" #,##0.00'
DATOS = [  # pestaña, hoja CSV, columnas de dinero, columnas de enteros, anchos
    ('Productos', 'productos', 'EFGIMN', 'H', [13, 40, 20, 15, 12, 12, 12, 10, 16, 9, 7, 22, 16, 18]),
    ('Movimientos', 'movimientos', 'HIJK', 'G', [7, 17, 10, 13, 38, 15, 10, 15, 14, 14, 14, 24, 9]),
    ('Gastos', 'gastos', 'E', '', [7, 17, 32, 12, 13, 9, 24, 9]),
    ('Deudas', 'creditos', 'FHIJKM', 'G', [7, 17, 22, 13, 34, 13, 8, 12, 15, 13, 13, 14, 13, 11]),
    ('Lotes', 'lotes', 'CDEFHIJK', 'L', [7, 30, 15, 17, 20, 18, 14, 24, 18, 17, 15, 10, 10]),
]

def bajar(hoja):
    url = f'{BASE}/api/finanzas/csv/{hoja}?clave={TOKEN}'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'excel-finanzas'}), timeout=60) as r:
        return list(csv.reader(io.StringIO(r.read().decode('utf-8-sig'))))

def numero(v):
    if isinstance(v, str):
        t = v.strip()
        if t.startswith("'"):          # el Worker antepone ' a lo que parecería una fórmula
            return t[1:]
        try:
            return int(t) if t.lstrip('-').isdigit() and not (len(t) > 1 and t[0] == '0') else float(t) if t.replace('.', '', 1).lstrip('-').isdigit() else v
        except ValueError:
            return v
    return v

wb = Workbook()
panel = wb.active
panel.title = 'Panel'
borde = Border(bottom=Side(style='thin', color='E3D7CC'))
cab_relleno = PatternFill('solid', fgColor=VINO)

for nombre, hoja, dinero, enteros, anchos in DATOS:
    ws = wb.create_sheet(nombre)
    filas = bajar(hoja)
    for fila in filas:
        ws.append([numero(c) for c in fila])
    for i, c in enumerate(ws[1], 1):
        c.font, c.fill = Font(bold=True, color='FFFFFF'), cab_relleno
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = anchos[i - 1] if i <= len(anchos) else 14
    ws.row_dimensions[1].height = 32
    ws.freeze_panes = 'A2'
    if ws.max_row > 1:
        ws.auto_filter.ref = ws.dimensions
    for fila in ws.iter_rows(min_row=2):
        for c in fila:
            col = get_column_letter(c.column)
            if col in dinero and isinstance(c.value, (int, float)):
                c.number_format = MONEDA
            elif col in enteros:
                c.number_format = '#,##0'
            c.border = borde
    ws.sheet_properties.tabColor = ORO

# colores condicionales
deudas, mov, lotes = wb['Deudas'], wb['Movimientos'], wb['Lotes']
rojo, verde = PatternFill('solid', bgColor='F6D5D1', fgColor='F6D5D1'), PatternFill('solid', bgColor='D9EEDD', fgColor='D9EEDD')
deudas.conditional_formatting.add('N2:N5000', CellIsRule(operator='equal', formula=['"Vencido"'], fill=rojo, font=Font(bold=True, color='9B2C2C')))
deudas.conditional_formatting.add('N2:N5000', CellIsRule(operator='equal', formula=['"Pagado"'], fill=verde))
mov.conditional_formatting.add('A2:M5000', FormulaRule(formula=['$M2="Sí"'], font=Font(color='999999', strike=True)))
wb['Gastos'].conditional_formatting.add('A2:H5000', FormulaRule(formula=['$H2="Sí"'], font=Font(color='999999', strike=True)))
lotes.conditional_formatting.add('H2:H500', CellIsRule(operator='equal', formula=['0'], fill=verde))

# ---------------- PANEL (todo fórmulas) ----------------
P, M, G, D, L = "Productos", "Movimientos", "Gastos", "Deudas", "Lotes"
R = 5000
def sm(col, *crit):  # SUMIFS sobre Movimientos
    pares = ''.join(f',{M}!${c}$2:${c}${R},{v}' for c, v in crit)
    return f'SUMIFS({M}!${col}$2:${col}${R}{pares})'

panel.sheet_view.showGridLines = False
panel.column_dimensions['A'].width = 2
panel.column_dimensions['B'].width = 46
panel.column_dimensions['C'].width = 20
panel.column_dimensions['D'].width = 62
panel['B1'] = 'Alexa Detalles · Panel de finanzas'
panel['B1'].font = Font(size=20, bold=True, color=VINO)
panel['B2'] = 'Todo lo de esta hoja son fórmulas: se recalcula solo cuando cambian las pestañas de datos.'
panel['B2'].font = Font(italic=True, color='7A6A60')

fila = [4]
def seccion(titulo):
    r = fila[0]
    for col in 'BCD':
        panel[f'{col}{r}'].fill = cab_relleno
    panel[f'B{r}'] = titulo
    panel[f'B{r}'].font = Font(bold=True, color='FFFFFF', size=12)
    fila[0] += 1
refs = {}
def linea(clave, etiqueta, formula, nota='', formato=MONEDA, fuerte=False):
    r = fila[0]
    panel[f'B{r}'] = etiqueta
    panel[f'C{r}'] = formula
    panel[f'C{r}'].number_format = formato
    panel[f'C{r}'].alignment = Alignment(horizontal='right')
    panel[f'D{r}'] = nota
    panel[f'D{r}'].font = Font(color='7A6A60', size=10)
    for col in 'BCD':
        panel[f'{col}{r}'].border = borde
        if fuerte:
            panel[f'{col}{r}'].font = Font(bold=True, size=11, color=panel[f'{col}{r}'].font.color)
            panel[f'{col}{r}'].fill = PatternFill('solid', fgColor=VINO_CLARO)
    refs[clave] = f'$C${r}'
    fila[0] += 1
def espacio(): fila[0] += 1

seccion('INVERSIÓN Y STOCK LOCAL')
linea('inv_lotes', 'Invertido en lotes', f'=SUM({L}!$C$2:$C$500)', 'Lo que pagaste por compras grandes (ej. todo el catálogo)')
linea('inv_compras', 'Compras sueltas de stock local 2', '=' + sm('J', ('C', '"Compra"'), ('M', '"<>Sí"')), 'Botón «Compré» del Inventario')
linea('inversion', 'INVERSIÓN TOTAL', f"={refs['inv_lotes']}+{refs['inv_compras']}", '', fuerte=True)
linea('meta', 'Meta de ventas', f'=SUM({L}!$D$2:$D$500)', 'Lo que quieres vender con todo lo invertido')
linea('val1', 'Stock local 1 a tus precios', f'=SUMIFS({P}!$N$2:$N${R},{P}!$D$2:$D${R},"Stock local 1")', 'Lo que tienes sin inversión')
linea('val2', 'Stock local 2 a tus precios', f'=SUMIFS({P}!$N$2:$N${R},{P}!$D$2:$D${R},"Stock local 2")', 'Lo comprado con inversión')
linea('vend_local', 'Ya vendido del stock local', '=' + sm('J', ('C', '"Venta"'), ('M', '"<>Sí"'), ('F', '"Stock local 1"')) + '+' + sm('J', ('C', '"Venta"'), ('M', '"<>Sí"'), ('F', '"Stock local 2"')))
linea('total_local', 'VALOR TOTAL DEL STOCK LOCAL', f"={refs['val1']}+{refs['val2']}+{refs['vend_local']}", 'Lo que vale todo lo cargado a tus precios (en stock + vendido)', fuerte=True)
linea('falta_cubrir', 'Falta para cubrir la inversión', f"=MAX(0,{refs['inversion']}-{refs['total_local']})", 'Cuánto más en productos (a tus precios) para cubrir lo invertido')
linea('falta_meta', 'Falta para la meta', f"=IF({refs['meta']}=0,0,MAX(0,{refs['meta']}-{refs['total_local']}))")
linea('subida', 'Subida de precios necesaria para la meta', f"=IF(AND({refs['total_local']}>0,{refs['total_local']}<{refs['meta']}),{refs['meta']}/{refs['total_local']}-1,0)", 'En promedio, cuánto tendrían que subir tus precios', formato='0.0%')
linea('ganancia_todo', 'Ganancia si vendes todo', f"={refs['total_local']}-{refs['inversion']}", 'Valor total − inversión', fuerte=True)
linea('margen_todo', 'Margen si vendes todo', f"=IFERROR({refs['ganancia_todo']}/{refs['inversion']},0)", formato='0.0%')
linea('falta_recuperar', 'Falta por VENDER para recuperar la inversión', f"=MAX(0,{refs['inversion']}-{refs['vend_local']})", 'Lo ya vendido del stock local frente a lo invertido')
espacio()
seccion('VENTAS Y GANANCIA')
linea('vendido', 'Vendido', '=' + sm('J', ('C', '"Venta"'), ('M', '"<>Sí"')), 'Las ventas a crédito cuentan por el total del crédito')
linea('ganancia', 'Ganancia (vendido − costo)', '=' + sm('K', ('C', '"Venta"'), ('M', '"<>Sí"')))
linea('gastos', 'Gastos (bus, envío, empaque…)', f'=SUMIFS({G}!$E$2:$E${R},{G}!$H$2:$H${R},"<>Sí")')
linea('neta', 'GANANCIA NETA', f"={refs['ganancia']}-{refs['gastos']}", 'Ganancia − gastos', fuerte=True)
espacio()
seccion('DEUDAS (VENTAS A CRÉDITO)')
linea('por_cobrar', 'Por cobrar', f'=SUMIFS({D}!$K$2:$K${R},{D}!$N$2:$N${R},"<>Pagado")')
linea('vencido', 'De eso, ya vencido', f'=SUM({D}!$M$2:$M${R})', 'Cobros atrasados: recuérdales el pago')
linea('n_deudas', 'Deudas activas', f'=COUNTIFS({D}!$N$2:$N${R},"Al día")+COUNTIFS({D}!$N$2:$N${R},"Vencido")', formato='0')
espacio()

# tablas pequeñas para los gráficos
r0 = fila[0]
seccion('PARA LOS GRÁFICOS')
tabla1 = fila[0]
for i, (etq, crit) in enumerate([('Stock aparte', 'Stock aparte'), ('Stock local 1', 'Stock local 1'), ('Stock local 2', 'Stock local 2')]):
    r = tabla1 + i
    panel[f'B{r}'] = f'Ventas · {etq}'
    panel[f'C{r}'] = '=' + sm('J', ('C', '"Venta"'), ('M', '"<>Sí"'), ('F', f'"{crit}"'))
    panel[f'C{r}'].number_format = MONEDA
fila[0] += 3
tabla2 = fila[0]
for i, cat in enumerate(['Bus', 'Envío', 'Empaque', 'Comisión', 'Otro']):
    r = tabla2 + i
    panel[f'B{r}'] = f'Gastos · {cat}'
    panel[f'C{r}'] = f'=SUMIFS({G}!$E$2:$E${R},{G}!$D$2:$D${R},"{cat}",{G}!$H$2:$H${R},"<>Sí")'
    panel[f'C{r}'].number_format = MONEDA
fila[0] += 5
tabla3 = fila[0]
for i, (etq, ref) in enumerate([('Inversión', 'inversion'), ('Valor a tus precios', 'total_local'), ('Meta', 'meta')]):
    r = tabla3 + i
    panel[f'B{r}'] = etq
    panel[f'C{r}'] = f'={refs[ref]}'
    panel[f'C{r}'].number_format = MONEDA
fila[0] += 3

g1 = BarChart(); g1.type = 'col'; g1.title = 'Inversión, lo cargado y la meta'; g1.legend = None
g1.add_data(Reference(panel, min_col=3, min_row=tabla3, max_row=tabla3 + 2), titles_from_data=False)
g1.set_categories(Reference(panel, min_col=2, min_row=tabla3, max_row=tabla3 + 2))
g1.height, g1.width = 7.5, 13
g1.dataLabels = DataLabelList(); g1.dataLabels.showVal = True
panel.add_chart(g1, 'F4')
g2 = BarChart(); g2.type = 'bar'; g2.title = 'Ventas por tipo de stock'; g2.legend = None
g2.add_data(Reference(panel, min_col=3, min_row=tabla1, max_row=tabla1 + 2), titles_from_data=False)
g2.set_categories(Reference(panel, min_col=2, min_row=tabla1, max_row=tabla1 + 2))
g2.height, g2.width = 7.5, 13
panel.add_chart(g2, 'F20')
g3 = PieChart(); g3.title = 'Gastos por tipo'
g3.add_data(Reference(panel, min_col=3, min_row=tabla2, max_row=tabla2 + 4), titles_from_data=False)
g3.set_categories(Reference(panel, min_col=2, min_row=tabla2, max_row=tabla2 + 4))
g3.height, g3.width = 7.5, 13
panel.add_chart(g3, 'F36')

panel.sheet_properties.tabColor = VINO
wb.move_sheet('Panel', offset=-wb.index(wb['Panel']))
wb.save(SALIDA)
print('Listo:', SALIDA)
