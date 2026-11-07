# NHC Hurricanes

Verfolge in Gladys die tropischen Stürme und Hurrikane des
[National Hurricane Center](https://www.nhc.noaa.gov) (NHC, NOAA, USA): das Atlantikbecken (mit der
Karibik und dem Golf), den Ostpazifik und den Zentralpazifik (Hawaii). Für jeden Sturm: seine
Einstufung, seine Saffir-Simpson-Kategorie, sein Dauerwind, seine Entfernung von deinem Zuhause, seine
Zugbahn und die Küstenvorwarnungen und -warnungen seiner letzten Meldung. Für jedes Becken: die Chance,
dass sich innerhalb von 48 Stunden und 7 Tagen ein neuer Sturm bildet, laut Tropical Weather Outlook.
Kein Konto, kein API-Schlüssel.

Dies ist kein offizieller Warndienst: Befolge im Notfall die Anweisungen deiner örtlichen Behörden und
deines nationalen Wetterdienstes. Nicht mit der NOAA oder dem National Weather Service verbunden.

## Was du bekommst

- Ein **Gerät pro verfolgtem Becken**: Anzahl aktiver Systeme, stärkstes System (ausgeschrieben), seine
  Kategorie und sein Dauerwind, und die höchste Entstehungschance in 48 Stunden und 7 Tagen.
- Ein Gerät **Nächster Hurrikan**: der Sturm, der deinem Zuhause am nächsten ist, seine Kategorie, sein
  Dauerwind, seine Entfernung, seine Richtung (von zu Hause gesehen) und seine Zugbahn, mit Verlauf von Kategorie, Wind und Entfernung. Ohne Sturm behält die Richtung
  ihren letzten Wert.
- Ein **Dashboard-Widget** mit den aktiven Stürmen, stärkster zuerst, jeweils mit Meldung und
  Prognosekegel, und der Entstehungsprognose jedes Beckens.
- Vier **Szenenauslöser**: neuer benannter Sturm, Sturm im Radius um dein Zuhause, Kategorie erhöht
  (Hurrikan, schwerer Hurrikan) und neue Küstenvorwarnung oder -warnung.
- Eine **Szenenaktion**, die die aktiven Stürme als einen Satz liest, zum Senden per Nachricht oder zum
  Vorlesen.

Neben der GDACS-Integration, die die Wirbelstürme der ganzen Welt nach ihren humanitären Folgen grün,
orange oder rot einstuft, liefert diese das offizielle amerikanische Detail der drei NHC-Becken: die
Saffir-Simpson-Kategorie, die Meldungen, die Vorwarnungen und Warnungen und die Entstehungsprognose.

## Voraussetzungen

- Gladys Assistant 5.1 oder neuer.
- Internetzugang vom Gladys-Rechner (die Integration liest `www.nhc.noaa.gov`).
- Für Entfernungen und den nächsten Sturm: ein Standort für dein Haus in Gladys (Einstellungen →
  Häuser) oder Koordinaten in der Konfiguration.

## Konfiguration

Installiere die Integration aus dem Store (oder Integrationen → Von GitHub installieren, mit der Adresse
`https://github.com/guim31/gladys-nhc`), speichere die Konfiguration und lege dann die Geräte im Tab
**Entdecken** an.

### Einstellungen

| Einstellung                        | Standard                          | Bedeutung                                                                                           |
| ---------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Breiten- / Längengrad des Zuhauses | leer                              | Lass beide leer, um den Standort deines Hauses in Gladys zu verwenden. Dezimalgrad, Westen negativ. |
| Becken                             | alle drei                         | Ein Gerät pro verfolgtem Becken; der nächste Sturm wird nur dort gesucht.                           |
| Einheiten                          | Imperial                          | Imperial (mph, Meilen) oder metrisch (km/h, km), für Geräte und Szenen.                             |
| Radius                             | 300                               | In Meilen oder Kilometern, je nach Einheit, für den Auslöser „Sturm im Radius“.                     |
| Auslöser für                       | Alle Stürme der verfolgten Becken | Oder nur die Stürme im Radius.                                                                      |
| Aktualisierungsintervall           | 15 Minuten                        | 10, 15, 30 oder 60 Minuten.                                                                         |
| Sprache der Texte                  | Französisch                       | Namen der Geräte und Funktionen (bei ihrer Erstellung festgelegt) und Szenentexte.                  |

### Einheiten und Namen

Eine Änderung der Einheiten oder der Sprache ändert die Geräte: Gladys bietet dann an, sie im Tab
Entdecken zu **aktualisieren**. Die Funktionsnamen bleiben die ihrer Erstellung. Windgeschwindigkeiten
werden wie in den NHC-Meldungen auf 5 mph oder 5 km/h gerundet.

## Geräte

**Becken-Gerät** (Hurrikane Atlantik, Ostpazifik, Zentralpazifik):

| Funktion                 | Typ                         | Werte                                            |
| ------------------------ | --------------------------- | ------------------------------------------------ |
| Aktive Systeme           | Zähler                      | vom NHC im Becken verfolgte Stürme               |
| Stärkstes System         | Text                        | „Hurrikan Melissa“ oder „Kein aktives System“    |
| Höchste Kategorie        | Zähler 0-5                  | Saffir-Simpson-Kategorie, 0 unter Hurrikanstärke |
| Stärkster Dauerwind      | Geschwindigkeit (mph, km/h) | 0 ohne Sturm                                     |
| Entstehungschance 48 h   | Prozent                     | höchste Chance der Störungen der Prognose        |
| Entstehungschance 7 Tage | Prozent                     | ebenso, innerhalb von 7 Tagen                    |

Außerhalb der Saison gibt das NHC keine Prognose heraus: Die Entstehungschancen werden dann nicht
veröffentlicht (statt falscher 0 %).

**Nächster Hurrikan**: Sturm (Einstufung und Name), Kategorie 0-5, Dauerwind, Entfernung (Meilen oder
km), Richtung (Grad, 0 Norden, 90 Osten, von zu Hause gesehen) und Zugbahn („Richtung W mit 21 km/h“).
Ohne Sturm steht dort „Kein aktives System“ und die Entfernung ist der halbe Erdumfang (12 451 Meilen
oder 20 038 km), damit eine Bedingung „unter 300 Meilen“ falsch bleibt. Ohne Standort deines Zuhauses
wird dieses Gerät nicht aktualisiert.

Die Geräte werden von der Integration selbst aktualisiert (nicht durch die Abfrage von Gladys).

## Dashboard-Widget

**Hurrikane (NHC)**: die Anzahl aktiver Systeme, dann die Stürme der verfolgten Becken, stärkster zuerst
(höchstens 8): Einstufung und Name, Wind und Entfernung und ein Abzeichen mit der Kategorie (rot für einen
schweren Hurrikan, orange für einen Hurrikan). Tippe auf einen Sturm, um Position, Zugbahn, Luftdruck,
die geltenden Küstenwarnungen und die Links zur öffentlichen Meldung und zum Prognosekegel zu sehen.
Darunter eine Zeile pro Becken mit den Entstehungschancen in 48 Stunden und 7 Tagen (Einstellung **Entstehungsprognose anzeigen**, um sie auszublenden) und ein Link zum NHC (Einstellung
**Link zum NHC anzeigen**). Das Widget folgt den Einheiten des Nutzers, der
es ansieht.

## Szenenauslöser

Alle lassen sich nach **Becken** filtern. „Auslöser für“ wählt, ob die Auslöser neuer Sturm, Kategorie und
Küstenwarnung für alle Stürme der verfolgten Becken gelten oder nur für die im Radius. Mit dem Radius werden ein
Name, eine Kategorie oder eine Warnung, die vor dem Eintritt des Sturms in den Radius kommen, später
nicht gemeldet: Beim Eintritt löst nur **Sturm im Radius** aus.

- **NHC: neuer benannter Sturm**: ein System wird zum tropischen (oder subtropischen) Sturm oder zum
  Hurrikan und bekommt einen Namen.
- **NHC: Sturm im Radius**: das Zentrum eines Sturms kommt in den Radius. Er löst erst wieder aus, wenn
  der Sturm den Radius um mehr als 10 % verlassen hat.
- **NHC: Kategorie erhöht**: Filter **Änderung**: zum Hurrikan geworden, zum schweren Hurrikan geworden
  (Kategorie 3 oder mehr; gewinnt, wenn beides zugleich passiert) oder andere Kategorieerhöhung.
- **NHC: Küstenwarnung**: die letzte öffentliche Meldung eines Sturms setzt eine neue Art von Vorwarnung
  oder Warnung in Kraft: Hurrikan, Sturmflut oder Tropensturm, Vorwarnung oder Warnung (Filter
  **Vorwarnung oder Warnung**). Die Gebiete sind die der Meldung, auf Englisch: Prüfe, ob deines dabei
  ist. Für die offiziellen Warnungen deines Bezirks siehe die NWS-Warnungen-Integration.

Variablen: Sturm-ID, Name, Einstufung (Code und ausgeschrieben), Becken, Kategorie, Dauerwind,
Entfernung von zu Hause, Zusammenfassung, Link zur Meldung; dazu die Änderung und die vorherige
Kategorie oder die Art der Warnung und ihre Gebiete.

Die beim ersten Start oder beim Speichern der Konfiguration vorhandenen Stürme lösen nichts aus: Das
sind keine Neuigkeiten. Ein Neustart auch nicht.

## Szenenaktion

**NHC: aktuelle Stürme lesen** gibt `text` (ein Satz: „2 aktive Systeme: Hurrikan Melissa, Kategorie 5,
270 km/h, 230 km SW von zu Hause; …“, dazu die höchste Entstehungschance in 7 Tagen), `count` und
`max_category` zurück. Nutze sie in einer Nachricht oder mit der Sprachausgabe.

## Szenenbeispiele

- Wenn **NHC: Sturm im Radius** auslöst, sende `summary` an die ganze Familie.
- Wenn **NHC: Küstenwarnung** mit **Hurrikanwarnung** auslöst, sende die `areas` per Nachricht.
- Jeden Morgen in der Saison, wenn die Kategorie des nächsten Hurrikans über 0 liegt, lies die Stürme
  vor.

## Datenquellen, Bedingungen und Kontingente

- `https://www.nhc.noaa.gov/CurrentStorms.json`: die aktiven Stürme.
- `https://www.nhc.noaa.gov/index-at.xml`, `index-ep.xml`, `index-cp.xml`: der Feed jedes Beckens, mit
  dem Tropical Weather Outlook und den öffentlichen Meldungen.

Die Daten des National Hurricane Center der NOAA sind gemeinfrei. Es gibt kein veröffentlichtes
Kontingent: Die Integration sendet 1 Anfrage pro Zyklus plus 1 pro verfolgtem Becken (standardmäßig 4
alle 15 Minuten), mit einem User-Agent, der sie nennt. Der Standort deines Zuhauses wird nie gesendet:
Die Entfernungen werden in der Integration berechnet.

## Fehlerbehebung

- **„Das National Hurricane Center antwortet nicht“**: die NHC-Website ist vom Gladys-Rechner nicht
  erreichbar; die Werte bleiben erhalten und die Integration versucht es bei jedem Zyklus erneut.
- **Keine Entfernung, kein nächster Sturm**: Gib deinem Haus einen Standort (Einstellungen → Häuser)
  oder trage Koordinaten ein.
- **Keine Entstehungschance**: außerhalb der Saison (Dezember bis Mai) gibt das NHC keine Prognose
  heraus.
- **Einheiten oder Namen nicht aktualisiert**: Aktualisiere die Geräte im Tab Entdecken.
- Protokolle: `docker logs` des Integrationscontainers; `LOG_LEVEL=debug` zeigt jeden Zyklus.

## Grenzen

- Nur drei Becken: Das NHC deckt weder den Westpazifik (Taifune) noch den Indischen Ozean noch die
  Südhalbkugel ab: siehe die GDACS-Integration.
- Entfernungen werden zum Zentrum des Sturms gemessen, nicht zum Rand seines Windfelds.
- Die Vorwarnungen und Warnungen stammen aus dem Text der Meldung, so wie veröffentlicht; ihre Gebiete
  sind auf Englisch.
- Das NHC aktualisiert seine Meldungen alle 6 Stunden (3 Stunden nahe der Küste): Die Werte sind nicht in
  Echtzeit.
