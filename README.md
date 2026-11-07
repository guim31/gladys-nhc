# NHC Hurricanes for Gladys Assistant

Tropical storms and hurricanes of the US [National Hurricane Center](https://www.nhc.noaa.gov)
(NOAA) in [Gladys Assistant](https://gladysassistant.com): the Atlantic basin (Caribbean and Gulf
included), the Eastern Pacific and the Central Pacific (Hawaii). Saffir-Simpson category, sustained
wind, distance and direction from your home, coastal watches and warnings, and the formation chances
of the Tropical Weather Outlook. No account, no API key.

Not an official alert service: in an emergency, the instructions of your local authorities and of
your national weather service always prevail. Not affiliated with NOAA or the National Weather
Service.

## Features

- **One device per followed basin**: active systems, strongest system in words, its category and
  sustained wind, highest formation chance within 48 hours and 7 days; with history.
- **A "Nearest hurricane" device**: storm, category, sustained wind, distance, direction seen from
  your home, movement.
- **Scene triggers**: new named storm, storm within a radius around your home, category raised
  (hurricane, major hurricane), new coastal watch or warning in the public advisory; filtered by
  basin, with the storm details as scene variables.
- **Scene action**: the active storms as one sentence, to send by message or have read aloud.
- **Dashboard widget**: the active storms, strongest first, each with its advisory and forecast
  cone, and the formation outlook of each basin.
- Imperial (mph, miles) or metric units; texts in English, French, German and Spanish.

Compared with the [GDACS integration](https://github.com/guim31/gladys-gdacs), which rates the
cyclones of the whole world by their humanitarian impact, this one gives the official US detail of
the three NHC basins.

## Requirements

- Gladys Assistant 5.1 or later.
- Internet access from the Gladys host (`www.nhc.noaa.gov`).
- A location for your house in Gladys, or coordinates in the configuration (for distances).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-nhc` (or install it from the catalog once it is listed). The
   install screen shows the **location** access it asks for (your home, for distances).
2. In **Configuration**, choose the basins, the units, the radius and the scope of the triggers,
   then save. **Show the current storms** lists what the NHC follows now.
3. Open the **Discover** tab and add the devices.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

```
Integration container ──HTTPS──▶ www.nhc.noaa.gov   CurrentStorms.json, index-{at,ep,cp}.xml
      │ SDK (WebSocket + host API)
      ▼
Gladys core ── devices, states, scene events, scene action, widget
```

- Every 10, 15, 30 or 60 minutes the container reads the active storms, then the RSS feed of each
  followed basin (outlook and public advisories). The devices are published with
  `should_poll: false`: the refresh runs in the container (GladysAssistant/Gladys#3198).
- Distances and directions are computed in the container, from the home to the centre of each
  storm: the location is never sent nor logged.
- What was seen (named, inside the radius, category, kinds of watches) is kept under `/data`, so a
  restart fires no trigger again; the storms already there at the first start or after a change of
  settings are not news either.

## Limitations

- Three basins only: no western Pacific typhoons, no Indian Ocean, no southern hemisphere (see
  GDACS).
- Distances are measured to the centre of the storm, not to the edge of its wind field.
- The watches and warnings are read from the text of the public advisory; their areas are in
  English. For the official alerts of a US county, use a NWS alerts integration.
- Out of season the NHC issues no outlook: the formation chances are then not published.
- Developed and tested against the real NHC products and the SDK's fake Gladys; not yet on a real
  Gladys instance: feedback welcome.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake NHC serving the real products recorded on
7/11/2026 (Tropical Storm Pena) and the public advisory 25 of Hurricane Melissa (2025),
`test/fixtures/nhc/`: never the network.

## Credits

- Data: [National Hurricane Center](https://www.nhc.noaa.gov) and Central Pacific Hurricane
  Center, NOAA / National Weather Service, public domain.
- Cover: the NOAA emblem, from
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:NOAA_logo.svg) (work of the US
  federal government, public domain; insignia rules apply). Its use does not imply endorsement.
- Built on the [Gladys integration SDK](https://github.com/GladysAssistant/integration-sdk-js) and
  the official JavaScript template.

## License

[Apache 2.0](LICENSE).
