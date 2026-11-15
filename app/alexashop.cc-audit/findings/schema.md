# Schema / Structured Data · 82/100

## Lo que funciona
- Store, WebSite, Product y BreadcrumbList válidos (sin errores de sintaxis)
- ItemList en el catálogo y las colecciones (nuevo)

## Hallazgos
### [Medium] La tienda no declara horario, coordenadas ni mapa
El Store tiene dirección (ciudad y país) y teléfonos, pero no openingHours, geo ni hasMap.

**Recomendación:** Agregarlos cuando se confirme el horario y la dirección; enlazar el perfil de Google Business.

### [Low] Product sin brand, política de devolución ni envío
Google Merchant recomienda brand, hasMerchantReturnPolicy y shippingDetails.

**Recomendación:** Agregar cuando las políticas de cambios y envíos estén definidas por la tienda.

