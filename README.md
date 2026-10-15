# Búsqueda del tesoro geolocalizada con QR

**Facultad:** (completar) · **Materia:** (completar)

**Integrantes:**
- Nombre Apellido
- Nombre Apellido
- Nombre Apellido
- Nombre Apellido

> Declaración de uso de IA: se usó un asistente de IA para generar el borrador del código. Qué se verificó a mano: (completar).

## Qué es

Web app para una búsqueda del tesoro en una plaza (10 a 12 puntos, 4 horas). Cada pista se libera solo si el equipo está dentro de la geocerca del punto (haversine), escanea el QR pegado en el lugar y resuelve el desafío. **Todo se valida en el servidor.** Funciona en Chrome (Android) y Safari (iOS), sin instalación y con costo cero.

## Arquitectura

```
Celular (HTML/JS estático, GitHub Pages)  --HTTPS-->  Supabase (Postgres + funciones RPC + Auth)
  index.html  jugador                                   tablas con RLS sin políticas (el navegador no las lee)
  admin.html  organizador (login)                       submit_arrival: orden + haversine + token + desafío + tiempo
  generator.html  QR imprimibles                        leaderboard / cronómetro: calculados con now() del servidor
```

Decisiones y alternativas:
- **Supabase RPC en vez de leer tablas desde el cliente:** las coordenadas, los hashes y las respuestas nunca viajan al navegador. Alternativa descartada: Firebase con reglas de seguridad, más difícil de expresar para validar haversine y orden.
- **Hosting estático (GitHub Pages):** HTTPS gratis, requisito de la Geolocation API.
- **Una sola lectura de GPS por intento** (no `watchPosition`) y refrescos cada 30 s solo con pantalla visible: ahorra batería durante 4 horas.
- **Progreso en el servidor** + `localStorage` solo para guardar `team_id` y `secret`: recargar la página o perder conexión no pierde nada.

## Puesta en marcha

1. Crear proyecto en [Supabase](https://supabase.com) (plan gratuito).
2. `SQL Editor` > pegar y ejecutar `supabase/schema.sql`.
3. `Authentication` > `Users` > crear el usuario del organizador (email y contraseña) y ejecutar:
   ```sql
   insert into admins (email) values ('organizador@ejemplo.com');
   ```
4. Copiar `Project URL` y `anon key` a `docs/config.js`.
5. Publicar la carpeta `docs/` con GitHub Pages (`Settings > Pages`, rama `main`, carpeta `/docs`).
6. Abrir `admin.html`, iniciar sesión y cargar el JSON (ver abajo).

## Portabilidad: pasar el juego a otra plaza (sin tocar código)

1. Copiar `config/game.example.json` a `config/game.json` (está en `.gitignore`).
2. Marcar los puntos en Google My Maps o Google Maps y copiar latitud/longitud al JSON (`lat`, `lon`, `radius`).
3. Escribir nombre, pistas, desafíos, historia y `joinCode`. Cada punto tiene `variants`: agregá más variantes que las usadas y cambiá `"variant"` para rejugar la misma plaza con otra historia, otras pistas y otros desafíos.
4. Abrir `docs/generator.html`, cargar `game.json`, **generar**, **imprimir las tarjetas** y **descargar el JSON con hashes**.
5. En `admin.html`, **Cargar configuración** con ese JSON.
6. Pegar cada QR en su punto.

El archivo `game.json` final no debe subirse a un repositorio público: contiene los códigos manuales y las respuestas.

## Mecánicas de diseño implementadas

- Narrativa con final (intro, fragmento por punto, cierre).
- Un desafío distinto por punto, con contenido rejugable por variantes.
- Puntaje con bonus por velocidad (hasta 50, baja 1 cada 30 s) y pistas opcionales que cuestan puntos.

## Seguridad (resumen para el análisis de amenazas)

| Ataque | Mitigación |
|---|---|
| Compartir pista, QR o URL | El orden lo decide el servidor: solo se valida el punto actual de cada equipo. El QR no sirve sin estar dentro de la geocerca. |
| Adivinar tokens / saltear orden | Token aleatorio de 128 bits, guardado como hash sha256. No hay forma de pedir un punto arbitrario. |
| GPS falso | No se elimina del todo: se usan el token físico del QR y el límite de 2 s entre intentos. Se registra el error de posición para el informe. |
| Validaciones repetidas o simultáneas | `select ... for update` sobre el equipo, límite de 2 s entre envíos y clave primaria `(team, punto)`. |
| Panel sin credenciales | Funciones `admin_*` exigen sesión de Supabase Auth y que el email esté en `admins`. |
| Datos personales | Tablas con RLS sin políticas: solo se leen desde `admin_teams()`. No van al repositorio ni al JSON. |

Pendientes para la entrega: completar evidencia de cada mitigación, y tratar el consentimiento y la conservación de datos con el área legal de la USAL.

## Limitaciones conocidas

- Cada equipo arranca su cronómetro al registrarse (no hay un "arranque global").
- El mapa con Leaflet/OpenStreetMap, la importación KML/GeoJSON, el modo contrarreloj y el modo ensayo (opcionales) no están implementados.
- La distancia que se devuelve al fallar la geocerca (redondeada a 10 m) permite acercarse "caliente/frío"; es intencional, pero con varios intentos podría triangularse la posición del punto.

## Ejecutar con Streamlit

La interfaz es la misma (carpeta `docs/`); Streamlit solo la sirve. La validación sigue en Supabase.

**Local**
```bash
pip install -r requirements.txt
cp .streamlit/secrets.toml.example .streamlit/secrets.toml   # completar URL y anon key
streamlit run streamlit_app.py
```
Las pantallas son: jugador (`streamlit_app.py`), `Organizador` y `Generador QR` (menú lateral).

**Streamlit Community Cloud** (https://share.streamlit.io, plan gratuito, HTTPS incluido)
1. `Create app` > repositorio, rama `main`.
2. **Main file path:** `streamlit_app.py`
3. `Advanced settings` > `Secrets`: pegar `SUPABASE_URL` y `SUPABASE_ANON_KEY` (formato de `.streamlit/secrets.toml.example`).
4. Deploy. Los jugadores entran a la URL `https://TU-APP.streamlit.app`; el organizador, a `/Organizador`.

Nota: el GPS y la cámara dependen de que el navegador los permita dentro del iframe de Streamlit. Probalo en Android (Chrome) y en iOS (Safari) antes de la jugada. Si falla en algún celular, publicá `docs/` con GitHub Pages, que funciona igual.
