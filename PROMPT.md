Tech stack :

lets use something simple it need to run in a docker container and will beself hosted. the ui needs to be clean and modern use tailwind for css and use go as backend to serve the app use htmlx to serve the frontend. for pesistence please use sql light and try to keep it simple mainly the ui needs to be intuitive and simple. 

Prompt voor de agent:

Maak een Boerenbridge scorebordbord-app. Boerenbridge is een kaartspel waarbij elke ronde spelers bieden op het aantal slagen dat ze denken te winnen. Dit zijn de spelregels en vereisten voor de app:

Spelregels:

• Het spel wordt gespeeld met een standaard kaartspel (52 kaarten).

• Het aantal spelers is variabel (minimaal 2, maximaal afhankelijk van het aantal kaarten).

• Elke ronde deelt de deler een bepaald aantal kaarten uit: in ronde 1 krijgt iedereen 1 kaart, in ronde 2 krijgt iedereen 2 kaarten, enzovoort, tot het maximum (52 / aantal spelers, afgerond naar beneden). Daarna gaat het aantal kaarten per ronde weer omlaag (bijv. 1-2-3-…-max-…-3-2-1).

• Elke ronde biedt elke speler hoeveel slagen hij/zij denkt te winnen. De biedingen mogen niet optellen tot precies het totaal aantal slagen (de laatste bieder mag dat bod niet doen — dit heet de “blinde regel” of “deler mag niet uitkomen”).

• Na de ronde worden punten berekend:

• Als je exact je bod haalt: 10 punten + 2 punten per gewonnen slag.

• Als je je bod NIET haalt: -2 punten per slag verschil (te veel of te weinig).

Vereisten voor de app:

1. Voer spelersnamen in aan het begin van het spel (minimaal 2).

2. Toon per ronde een invoerscherm voor de biedingen van alle spelers (met de blinde-regel validatie voor de laatste bieder).

3. Na het spelen van de ronde: invoer van het werkelijke aantal gewonnen slagen per speler.

4. Automatische puntberekening en weergave van het scorebord (cumulatief per ronde).

5. Toon aan het einde van het spel de eindstand en de winnaar.

6. Optioneel: mogelijkheid om een nieuw spel te starten.

Bouw dit als een moderne web-app go en htmlx met een sql lite db voor persistentie chadcn als ui library met een duidelijke, gebruiksvriendelijke interface in het Nederlands.
