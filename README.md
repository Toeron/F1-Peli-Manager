<div align="center">
  <img src="public/images/banner_dashboard.png" alt="F1 Peli-Manager Banner" width="100%" style="border-radius: 12px; margin-bottom: 20px" />

  # 🏎️ F1 Peli-Manager

  Een dynamische, op maat gemaakte Formule 1 management game waar strategisch inzicht, slim budgetbeheer en voorspellende gaven samenkomen! Bouw je sterrenteam, voorspel de podiums en versla je vrienden in besloten leagues.
</div>

---

## 🏆 Hoe werkt het?

F1 Peli-Manager is niet zomaar een poultje. Het combineert de spanning van *fantasy sports* met een dynamisch economisch systeem. Elk raceweekend verdien je punten op drie verschillende manieren:

### 🏎️ 1. Team Punten
Je start het seizoen met een vast budget van **$100 Miljoen**. Hiermee koop je 4 coureurs voor je team. Zij scoren punten op basis van hun eindklassering in de **Race**, **Kwalificatie** en (indien van toepassing) **Sprintrace**.

| Positie | Race | Kwalificatie | Sprint |
| :---: | :---: | :---: | :---: |
| **P1** | 25 pnt | 8 pnt | 8 pnt* |
| **P2** | 18 pnt | 7 pnt | 7 pnt* |
| **P3** | 15 pnt | 6 pnt | 6 pnt* |
| **P4** | 12 pnt | 5 pnt | 5 pnt* |
| **P5** | 10 pnt | 4 pnt | 4 pnt* |
| **P6** | 8 pnt | 3 pnt | 3 pnt* |
| **P7** | 6 pnt | 2 pnt | 2 pnt* |
| **P8** | 4 pnt | 1 pnt | 1 pnt* |
| **P9** | 2 pnt | 0 pnt | 0 pnt |
| **P10** | 1 pnt | 0 pnt | 0 pnt |

*\* Sprintpunten zijn circa 25% van de reguliere race-punten voor die positie, afgerond.*

---

### 🎯 2. Voorspellingen (Top 3)
Voor elke sessie (Kwalificatie, Sprint, Race) voorspel je de exacte **Top 3**. Je scoort punten per coureur, afhankelijk van hoe dicht jouw voorspelling bij de *werkelijke eindpositie* van die coureur ligt. 

De punten die je krijgt zijn altijd een percentage van de puntenwaarde die hoort bij de **werkelijke finish positie** van die coureur:
- 🟢 **100% (Exacte match)**: Je voorspelt Verstappen op P1 en hij wordt P1. Je krijgt de volle 100% van de P1-punten (25 pnt).
- 🔵 **50% (1 plek ernaast)**: Je voorspelt Verstappen op P1, maar hij wordt P2. Je krijgt 50% van de P2-punten (9 pnt).
- ⚪ **25% (2 plekken ernaast)**: Je voorspelt Verstappen op P1, en hij wordt P3. Je krijgt 25% van de P3-punten (3.75 afgerond naar 4 pnt).
- ❌ **Verder er vandaan (>2 plekken) of buiten Top 3**: Voorspel je Hamilton op P1, maar hij wordt P4 of lager (of valt uit)? Dan krijg je voor deze voorspelling **0 punten**.

*(Let op: Bovenstaande bedragen gelden voor de Race. In de Kwalificatie of Sprintrace scoor je een percentage van de punten die gelden voor die specifieke sessie).*

---

### 🌟 3. Extra Race Bonussen
Speciaal voor de **Race** sessie verdien je ook extra punten door het correct voorspellen van de volgende overige variabelen (deze punten staan los van je Team of Top 3 coureurs):
- **Snelste Ronde (Fastest Lap)**: +5 punten bij juiste coureur.
- **Safety Car**: +2 punten bij correct 'Ja/Nee'.
- **Aantal DNF's (Gecrasht/Uitgevallen)**: +5 punten bij exact het juiste aantal.

---

### ⚡ 4. Synergy Bonus (De Gamechanger)
Dit is de ultieme boost! Als een coureur die je **in je Team** hebt gekocht, door jou **in je Voorspelling** is gezet én daadwerkelijk in de Top 3 eindigt, worden de basisscore-punten die deze coureur *voor jouw Team* heeft gescoord vermenigvuldigd!

De vermenigvuldiger wordt groter naarmate je voorspelling dichterbij zat:

| Afwijking Voorspelling | Vermenigvuldiger |
| :--- | :---: |
| **Exacte Match** (0 plekken ernaast) | **x 2.0** |
| **1 plek ernaast** | **x 1.5** |
| **2 plekken ernaast** | **x 1.25** |

> **💡 Rekenvoorbeeld Synergy:** 
> - Je hebt Verstappen **in je Team**.
> - Je voorspelt hem op **P2** voor de race.
> - Hij wint de race daadwerkelijk en finisht op **P1** (Team punten normaal: 25 pnt).
> - Je zat er 1 plek naast, dus je krijgt hiervoor de **x1.5 Synergy bonus**!
> - Jouw team krijgt voor Verstappen in de race geen 25 punten, maar **25 x 1.5 = 38 (afgerond)** punten!

---

## 💰 Budget & Team Selectie

Je begint het seizoen met een vast startbudget van **$100M**.

1. De prijzen van coureurs zijn gebaseerd op hun historische prestaties en **blijven het hele seizoen gelijk**.
2. Als je een team kiest dat minder dan $100M kost, blijft het restant gewoon in je account staan.
3. Dit overgebleven budget ('in kas') kun je bij volgende races gebruiken om eventueel duurdere coureurs te kiezen, of om wissels op te vangen.

**💡 Tip:** Je hoeft dus niet elke race je volledige budget op te maken. Slim sparen kan je helpen om later in het seizoen een sterker team op te stellen!

---

## 🛑 Lock-in Tijd

Spanning tot de laatste seconde! Je kunt je team en je voorspellingen onbeperkt wijzigen tot exact **5 minuten voor het begin van de allereerste sessie** (meestal de Kwalificatie of Sprint Kwalificatie) van het weekend. Danach is alles "Locked" en kun je (eindelijk) de voorspellingen van je vrienden en concurrenten bekijken in het Dashboard.

<br>

## 🛠️ Tech Stack & Credits
Gedreven door passie voor de sport en moderne webtechnologie:
- **Frontend Framework:** React + Vite
- **Backend & Database:** Supabase (PostgreSQL, Auth, RLS)
- **Styling:** CSS3 Modules met dynamische CSS Variables
- **Design:** Modern "Dark Mode" premium thema met custom avatars en FlagCDN integratie.
- **AI Assisted:** Gedeeltelijk ontwikkeld samen met Antigravity (Google DeepMind).

---
<div align="center">
  <i>Gereed voor de start? Lights out and away we go! 🚦</i>
</div>
