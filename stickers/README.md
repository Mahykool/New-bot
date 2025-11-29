# Stickers

Carpeta que contiene stickers usados por el bot.  
Este directorio almacena archivos de imagen que el plugin `randomsticker` puede enviar.

## Formato recomendado
- **Formato preferido:** `.webp` (mejor compatibilidad para stickers).  
- **Tamaños sugeridos:** 512×512 px.  
- **Peso recomendado:** ideal ≤ 100 KB para envío rápido.

## Nombres de archivo
- Usa nombres descriptivos y sin espacios, por ejemplo: `gato_feliz.webp`, `meme_01.webp`.  
- Evita caracteres especiales y acentos.

## Cómo añadir stickers
1. Coloca los archivos `.webp` dentro de esta carpeta.  
2. Si trabajas localmente con Git:
   ```bash
   git add stickers/nuevo-sticker.webp
   git commit -m "Add sticker nuevo-sticker"
   git push origin main
