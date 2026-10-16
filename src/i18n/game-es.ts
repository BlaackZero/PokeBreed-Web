// Traducción al español de los textos del juego original (Pokebreed Ultimate está en inglés).
// La clave es el texto exacto del juego; lo que no está aquí se busca en GAME_ES_PATTERNS
// y, si tampoco está, se muestra en inglés.

const STONE_DESC = 'Evoluciona a ciertos Pokémon. Se mueve como un Pokémon. Los Pokémon evolucionados no podrán criar.';
const DECO = (what: string) => `${what} para decorar tu rancho.`;
const TERRAIN = (what: string) => `${what}. Sirve para decorar tu rancho. Para moverlo, activa el modo terreno.`;
const CRISTAL = (what: string, into: string) =>
  `Cristal de ${what}. Modificador de terreno: toda la hierba se convierte en ${into} hasta que lo vendas. No puedes tener más de un modificador de terreno.`;

export const GAME_ES: Record<string, string> = {
  // ---------- Preguntas y mensajes ----------
  'Restart Game?': '¿Reiniciar la partida?',
  'Are you sure you want to quit Pokebreed?#All unsaved changes will be lost!': '¿Seguro que quieres salir de Pokebreed?#¡Se perderán los cambios no guardados!',
  'Yes': 'Sí',
  'No': 'No',
  'Type a cheat.': 'Escribe un truco.',
  '1 Day later...': '1 día después...',
  'The flytrap ate Caterpie and got 50exp.': 'La planta carnívora se comió a Caterpie y ganó 50 de exp.',
  'The bird ate Caterpie and got 50exp.': 'El pájaro se comió a Caterpie y ganó 50 de exp.',
  "'You have attained Bluba # the rarest pokemon in the game.'": "'Has conseguido a Bluba,# el Pokémon más raro del juego.'",
  'You have attained Bluba # the rarest pokemon in the game.': 'Has conseguido a Bluba,# el Pokémon más raro del juego.',
  "You don't have the pokemon in the middle area.": 'No tienes esos Pokémon en la zona central.',
  'Use fire ring? #You should save first.': '¿Usar el anillo de fuego? #Mejor guarda la partida antes.',
  'Are you sure you want to sell celibi?': '¿Seguro que quieres vender a Celebi?',
  'Are you sure you want to sell mewtwo?': '¿Seguro que quieres vender a Mewtwo?',
  'You got the Boulder Badge!': '¡Has conseguido la Medalla Roca!',
  'You got the Cascade Badge!': '¡Has conseguido la Medalla Cascada!',
  'You got the Thunder Badge!': '¡Has conseguido la Medalla Trueno!',
  'You got the Rainbow Badge!': '¡Has conseguido la Medalla Arcoíris!',
  'You got the Soul Badge!': '¡Has conseguido la Medalla Alma!',
  'You got the Marsh Badge!': '¡Has conseguido la Medalla Pantano!',
  'You got the Volcano Badge!': '¡Has conseguido la Medalla Volcán!',
  'You got the Earth Badge!': '¡Has conseguido la Medalla Tierra!',

  // ---------- Textos dibujados ----------
  'Exp': 'Exp',
  'Max Evolution': 'Evolución máxima',
  'Sun Stone': 'Piedra Solar',
  'All Stones': 'Todas las piedras',
  'Fire Stone': 'Piedra Fuego',
  'Attained using cheat': 'Conseguido con truco',
  'Multi Stones': 'Varias piedras',
  'Steel Stone': 'Piedra Acero',
  'Bring these pokemon to the middle area': 'Lleva estos Pokémon a la zona central',
  'Dragon Stone': 'Piedra Dragón',
  'Moon Stone': 'Piedra Lunar',
  'Psy Stone': 'Piedra Psíquica',
  'Fuse: Magnemite': 'Fusión: Magnemite',
  'Thunder Stone': 'Piedra Trueno',
  'Waste Product': 'Residuo',
  'Water Stone': 'Piedra Agua',
  'Evolve = Slowster': 'Evoluciona = Slowster',
  'No Evolution': 'Sin evolución',
  'Full Growth': 'Totalmente crecido',
  'Dark Stone': 'Piedra Oscura',
  'Steel/Dark Stones': 'Piedras Acero/Oscura',
  'Fuse: Beldum': 'Fusión: Beldum',
  'Fuse: Metang': 'Fusión: Metang',
  'Press Enter': 'Pulsa Enter',

  // ---------- Tienda: categorías y utilidades ----------
  'Balls': 'Balls',
  'Stones': 'Piedras',
  'Pokemon Male': 'Pokémon macho',
  'Pokemon Female': 'Pokémon hembra',
  'Pokemon Genderless': 'Pokémon sin género',
  'Other Stuff': 'Otras cosas',
  'Badges': 'Medallas',
  'Dolls': 'Muñecos',
  'Terrain': 'Terreno',
  'Help': 'Ayuda',
  'Toggle Fullscreen': 'Pantalla completa',
  'Save your game.': 'Guarda tu partida.',
  'Load a saved game': 'Carga una partida guardada.',
  'Terrain Edit is off. Click to turn on.': 'El modo terreno está desactivado. Haz clic para activarlo.',
  'Terrain Edit is on. Click to turn off.': 'El modo terreno está activado. Haz clic para desactivarlo.',
  'Boulder Badge': 'Medalla Roca',
  'Cascade Badge': 'Medalla Cascada',
  'Thunder Badge': 'Medalla Trueno',
  'Rainbow Badge': 'Medalla Arcoíris',
  'Soul Badge': 'Medalla Alma',
  'Marsh Badge': 'Medalla Pantano',
  'Volcano Badge': 'Medalla Volcán',
  'Earth Badge': 'Medalla Tierra',

  // ---------- Tienda: Balls ----------
  'Pokeball. Move Like a pokemon. Sell 1 pokemon with this.': 'Poké Ball. Se mueve como un Pokémon. Sirve para vender 1 Pokémon.',
  'Rubberball. Move Like a pokemon. Sell 1 electric pokemon with this.': 'Ball de goma. Se mueve como un Pokémon. Sirve para vender 1 Pokémon eléctrico.',
  'Masterball. Move like a pokemon. It will sell pokemon till you right click it.': 'Master Ball. Se mueve como un Pokémon. Vende Pokémon hasta que le hagas clic derecho.',

  // ---------- Tienda: piedras ----------
  'Leaf Stone. Evolves certain Pokemon. Move like a pokemon. Evolved pokemon will be unable to breed.': `Piedra Hoja. ${STONE_DESC}`,
  'Dark Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Oscura. ${STONE_DESC}`,
  'Fire Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Fuego. ${STONE_DESC}`,
  'Thunder Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Trueno. ${STONE_DESC}`,
  'Water Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Agua. ${STONE_DESC}`,
  'Sun Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Solar. ${STONE_DESC}`,
  'Psy Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Psíquica. ${STONE_DESC}`,
  'Steel Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Acero. ${STONE_DESC}`,
  'Dragon Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Dragón. ${STONE_DESC}`,
  'Moon Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Lunar. ${STONE_DESC}`,
  'Ice Stone. Evolves certain Pokemon. Move like a pokemon.Evolved pokemon will be unable to breed.': `Piedra Hielo. ${STONE_DESC}`,
  'Fusion Stone. Lets the pokemon fuse with other pokemon. Can only be used on pokemon that can fuse.': 'Piedra Fusión. Permite que un Pokémon se fusione con otros. Solo funciona con Pokémon que pueden fusionarse.',
  'Ever stone. Prevents pokemon from evolving by exp. Must remain in contact with pokemon for effect.': 'Piedra Eterna. Impide que un Pokémon evolucione por experiencia. Tiene que estar en contacto con el Pokémon.',

  // ---------- Tienda: Pokémon ----------
  'Eevee Male. A fox pokemon that can evolve from any stone.': 'Eevee macho. Un Pokémon zorro que puede evolucionar con cualquier piedra.',
  'Eevee Female. A fox pokemon that can evolve from any stone.': 'Eevee hembra. Un Pokémon zorro que puede evolucionar con cualquier piedra.',
  "Bulbasaur Male. A plant pokemon. It's ability is making flowers.": 'Bulbasaur macho. Un Pokémon planta. Su habilidad es crear flores.',
  "Bulbasaur Female. A plant pokemon. It's ability is making flowers.": 'Bulbasaur hembra. Un Pokémon planta. Su habilidad es crear flores.',
  "Charmander Male. A baby dragon pokemon. It's ability is making a fireball.": 'Charmander macho. Un Pokémon dragón bebé. Su habilidad es lanzar bolas de fuego.',
  "Charmander Female. A baby dragon pokemon. It's ability is making a fireball.": 'Charmander hembra. Un Pokémon dragón bebé. Su habilidad es lanzar bolas de fuego.',
  "Squirtle Male. A turtle pokemon. It's ability is to make bubbles.": 'Squirtle macho. Un Pokémon tortuga. Su habilidad es hacer burbujas.',
  "Squirtle Female. A turtle pokemon. It's ability is to make bubbles.": 'Squirtle hembra. Un Pokémon tortuga. Su habilidad es hacer burbujas.',
  'Pidgy Male. A bird Pokemon with no ability.': 'Pidgey macho. Un Pokémon pájaro sin habilidad.',
  'Pidgy Female. A bird Pokemon with no ability.': 'Pidgey hembra. Un Pokémon pájaro sin habilidad.',
  'A bug pokemon that evolves quickly.': 'Un Pokémon bicho que evoluciona rápido.',
  'Ekans Male. A snake pokemon that will eat any egg except snake eggs.': 'Ekans macho. Un Pokémon serpiente que se come cualquier huevo menos los de serpiente.',
  'Ekans female. A snake pokemon that will eat any egg except snake eggs.': 'Ekans hembra. Un Pokémon serpiente que se come cualquier huevo menos los de serpiente.',
  'Geodude. A rock pokemon that can make fossils.': 'Geodude. Un Pokémon roca que puede crear fósiles.',
  'Seaking. A freaky fish pokemon that completely changes gender every so often.': 'Seaking. Un Pokémon pez rarísimo que cambia de género cada cierto tiempo.',
  'Goldeen. A freaky fish pokemon that completely changes gender every so often.': 'Goldeen. Un Pokémon pez rarísimo que cambia de género cada cierto tiempo.',
  "Togepi Male. A fairy pokemon that has not fully come out of it's egg.": 'Togepi macho. Un Pokémon hada que aún no ha salido del todo de su huevo.',
  "Togepi Female. A fairy pokemon that has not fully come out of it's egg.": 'Togepi hembra. Un Pokémon hada que aún no ha salido del todo de su huevo.',
  'Staryu Male. A starfish pokemon that can make bubbles.': 'Staryu macho. Un Pokémon estrella de mar que puede hacer burbujas.',
  'Staryu Female. A starfish pokemon that can make bubbles.': 'Staryu hembra. Un Pokémon estrella de mar que puede hacer burbujas.',
  'Poliwag. A Tadpole Pokemon.': 'Poliwag. Un Pokémon renacuajo.',
  'Porygon. A pokemon from cyber space.': 'Porygon. Un Pokémon del ciberespacio.',
  'Magnemite. A stange man made pokemon that will stick to other Magnemites.': 'Magnemite. Un extraño Pokémon artificial que se pega a otros Magnemite.',
  'Pikachu Male. A very energetic electric pokemon.': 'Pikachu macho. Un Pokémon eléctrico muy enérgico.',
  'Pikachu Female. A very energetic electric pokemon.': 'Pikachu hembra. Un Pokémon eléctrico muy enérgico.',
  'Koffing. A man made pokemon that will multiply on its own. It will also explode if it comes in contact with fire. *Note: too many koffings will lag the game.':
    'Koffing. Un Pokémon artificial que se multiplica solo. Explota si toca el fuego. *Nota: demasiados Koffing ralentizan el juego.',
  "Tangela Male. A pokemon who's body is completely covered with vines that it grows.": 'Tangela macho. Un Pokémon con el cuerpo totalmente cubierto de lianas que hace crecer.',
  "Tangela Female. A pokemon who's body is completely covered with vines that it grows.": 'Tangela hembra. Un Pokémon con el cuerpo totalmente cubierto de lianas que hace crecer.',
  'Abra. A psychic pokemon that can emit psywaves. It breeds with ralts for babies of the same species.': 'Abra. Un Pokémon psíquico que emite psicoondas. Cría con Ralts y tienen bebés de su misma especie.',
  'Ralts. A psychic pokemon that can emit psywaves. It breeds with abra for babies of the same species.': 'Ralts. Un Pokémon psíquico que emite psicoondas. Cría con Abra y tienen bebés de su misma especie.',
  'Mr. Mime. A pokemon that can make barriers. It breeds with Jynx for babies of the same species.': 'Mr. Mime. Un Pokémon que crea barreras. Cría con Jynx y tienen bebés de su misma especie.',
  'Jynx. A Psychic/Ice Pokemon. It can make ice chunks. It breeds with Mr. Mime for babies of the same species.': 'Jynx. Un Pokémon psíquico/hielo. Crea bloques de hielo. Cría con Mr. Mime y tienen bebés de su misma especie.',
  'Tauros. A bull pokemon. It breeds with miltank for babies of the same species.': 'Tauros. Un Pokémon toro. Cría con Miltank y tienen bebés de su misma especie.',
  'Miltank. A cow pokemon. It breeds with tauros for babies of the same species.': 'Miltank. Un Pokémon vaca. Cría con Tauros y tienen bebés de su misma especie.',
  'Poochyena. A dark dog pokemon.': 'Poochyena. Un Pokémon perro siniestro.',
  'Nidoran Male. A poison rabbit pokemon.': 'Nidoran macho. Un Pokémon conejo venenoso.',
  'Nidoran Female. A poison rabbit pokemon.': 'Nidoran hembra. Un Pokémon conejo venenoso.',
  'Diglet. A mole pokemon that tunnels. *Note: too many diglets will lag the game.': 'Diglett. Un Pokémon topo que cava túneles. *Nota: demasiados Diglett ralentizan el juego.',
  'Delibird. A pokemon that loves to clean. It will remove all fireballs, ect that are laying around. Note: This pokemon has a low IQ and will try to go through fences to clean.':
    'Delibird. Un Pokémon al que le encanta limpiar. Recoge las bolas de fuego y demás cosas que haya por el suelo. Nota: no es muy listo e intentará atravesar las vallas para limpiar.',
  'Ditto. A pokemon that will instantly morph into any pokemon it touches.': 'Ditto. Un Pokémon que se transforma al instante en cualquier Pokémon que toque.',
  'Snorlax. An extremely big pokemon that wants to do nothing but sleep': 'Snorlax. Un Pokémon enorme que solo quiere dormir.',
  'Scyther. A bug pokemon with scyths of death.': 'Scyther. Un Pokémon bicho con guadañas mortales.',

  // ---------- Tienda: otras cosas ----------
  'A flower for decoration.': 'Una flor de decoración.',
  'A fireball for decoration.': 'Una bola de fuego de decoración.',
  'A bubble for decoration.': 'Una burbuja de decoración.',
  'A fossil for decoration.': 'Un fósil de decoración.',
  'An ice chunk for decoration': 'Un bloque de hielo de decoración.',
  'A vacume to suck up smog.': 'Una aspiradora para limpiar el humo.',
  'Custom Sign. Put any message you want here.': 'Cartel personalizado. Escribe en él el mensaje que quieras.',
  'Music Player. Middle click to change the song. 0-7 keys to change the song. 0 = no song.': 'Reproductor de música. Clic central o teclas 0-7 para cambiar la canción. 0 = sin música.',
  'Water cristal. A terrain modifyer. All grass becomes water untill this is sold. Cannot have more than 1 terrain modifyer.': CRISTAL('agua', 'agua'),
  'Fire cristal. A terrain modifyer. All grass becomes lava untill this is sold. Cannot have more than 1 terrain modifyer.': CRISTAL('fuego', 'lava'),
  'Clay cristal. A terrain modifyer. All grass becomes clay untill this is sold. Cannot have more than 1 terrain modifyer.': CRISTAL('arcilla', 'arcilla'),
  'Rare Candy. Gives 200 exp to the pokemon that eats it.': 'Caramelo Raro. Da 200 de exp al Pokémon que se lo come.',
  'Seed. Will gorw into a tree when watered.': 'Semilla. Si la riegas, crecerá hasta ser un árbol.',

  // ---------- Tienda: muñecos ----------
  'A Snorlax doll to decorate your area.': DECO('Un muñeco de Snorlax'),
  'A Gamecube to decorate your area': DECO('Una GameCube'),
  'A Rhydon doll to decorate your area.': DECO('Un muñeco de Rhydon'),
  'A Wailmer doll to decorate your area.': DECO('Un muñeco de Wailmer'),
  'A TV to decorate your area': DECO('Una tele'),
  'An Xbox to decorate your area': DECO('Una Xbox'),
  'A Moltres doll to decorate your area.': DECO('Un muñeco de Moltres'),
  'A Lugia doll to decorate your area.': DECO('Un muñeco de Lugia'),
  'A Mew doll to decorate your area.': DECO('Un muñeco de Mew'),
  'A Blastoise doll to decorate your area.': DECO('Un muñeco de Blastoise'),
  'A Charizard doll to decorate your area.': DECO('Un muñeco de Charizard'),

  // ---------- Tienda: terreno ----------
  'Grass. Use to decorate your ranch. Must have terrain edit on to move.': TERRAIN('Hierba'),
  'Light Grass. Use to decorate your ranch. Must have terrain edit on to move.': TERRAIN('Hierba clara'),
  'Clay. Use to decorate your ranch. Must have terrain edit on to move.': TERRAIN('Arcilla'),
  'Sand. Use to decorate your ranch. Must have terrain edit on to move.': TERRAIN('Arena'),
  'Soot. Use to decorate your ranch. Must have terrain edit on to move.': TERRAIN('Hollín'),
  'Water. Use to decorate your ranch. Must have terrain edit on to move.': TERRAIN('Agua'),
  'Breeding Pad. Pokemon will breed on this. Can be moved in terain edit mode.': 'Zona de cría. Los Pokémon crían encima. Se puede mover en el modo terreno.',
  'Fence for blocking pokemon. Can be moved in terrain edit mode.': 'Valla para cortar el paso a los Pokémon. Se puede mover en el modo terreno.',
  'Gate for blocking pokemon. Can be opened or closed with left click. Can be moved in terrain edit mode.': 'Puerta para cortar el paso a los Pokémon. Se abre y se cierra con clic izquierdo. Se puede mover en el modo terreno.',

  // ---------- Cría ----------
  'They had a baby of the same species': 'Tuvieron una cría de su misma especie',
  'They had a baby of the same species.': 'Tuvieron una cría de su misma especie.',
  'The crossbreed resulted in Mareep.': 'El cruce dio como resultado un Mareep.',
};

/** Palabras de los cruces "Fire + Turtle = Torkoal". */
const CROSS_WORDS: Record<string, string> = {
  Fire: 'Fuego', Turtle: 'Tortuga', Fox: 'Zorro', Water: 'Agua', Steam: 'Vapor', Rock: 'Roca', Snake: 'Serpiente',
  Horse: 'Caballo', Fish: 'Pez', Bird: 'Pájaro', Dragon: 'Dragón', Cyberspace: 'Ciberespacio', Butterfly: 'Mariposa',
  Poison: 'Veneno', Electric: 'Eléctrico', Dog: 'Perro', Rodent: 'Roedor', Mole: 'Topo', Psy: 'Psíquico',
};

/** Textos que se construyen en tiempo de ejecución o que siguen un mismo patrón. */
export const GAME_ES_PATTERNS: [RegExp, string | ((...m: string[]) => string)][] = [
  [/^They had a crossbreed of (.+?)\.?$/, 'Tuvieron una cría cruzada: $1.'],
  [/^They had a superbreed of (.+?)\.?$/, '¡Tuvieron una supercría: $1!'],
  [/^then click the check\. Then you get the (\w+) badge\.$/i, (_m, b) => `y pulsa Comprobar (✔). Así conseguirás la Medalla ${GAME_ES[`${b[0].toUpperCase()}${b.slice(1).toLowerCase()} Badge`]?.replace('Medalla ', '') ?? b}.`],
  [/^Music: (.*)$/, 'Música: $1'],
  [/^sing: (.*)$/, 'canto: $1'],
  [/^Water:(.*)$/, 'Agua:$1'],
  [/^Speed: (.*)$/, 'Velocidad: $1'],
  // Textos del propio runtime (partidas)
  [/^Name of the game to save:$/, 'Nombre de la partida a guardar:'],
  [/^There are no saved games\.$/, 'No hay partidas guardadas.'],
  [/^Saved games:#([\s\S]*)##Type the name of the one to load:$/, 'Partidas guardadas:#$1##Escribe el nombre de la que quieres cargar:'],
  [/^Could not save: (.*)$/, 'No se pudo guardar: $1'],
  [/^There is no saved game called "(.*)"\.$/, 'No existe la partida "$1".'],
  [/^([A-Za-z]+(?: \+ [A-Za-z]+)+) = ([^.]+)\.?$/, (_m, parts: string, result: string) =>
    `${parts.split(' + ').map((w) => CROSS_WORDS[w] ?? w).join(' + ')} = ${CROSS_WORDS[result] ?? result}`],
];

/** Ayuda del juego (Game Information del original), traducida. */
export const HELP_ES = `Pokebreed

Introducción:
Es un juego de criar Pokémon y hacerlos evolucionar. Hay un gimnasio donde consigues medallas llevando Pokémon a los líderes. También puedes comprar y vender Pokémon.

Cómo se juega:
Al empezar hay 2 Charmander, 2 Squirtle y 2 Bulbasaur en los corrales. Haz clic izquierdo en una puerta para abrirla o cerrarla. Arrastra cualquier Pokémon a donde quieras. Lleva 2 Pokémon de distinto género a una zona de cría (los corrales de las esquinas) y criarán. Dos de la misma especie tienen una cría igual; si son de especies distintas, salen otros Pokémon. La mayoría de los Pokémon evolucionan con el tiempo, pero algunos necesitan piedras. Los huevos tienen un 50 % de probabilidad de ser macho o hembra. Pulsa Enter para abrir la tienda y comprar más Pokémon.

Controles:
Clic izquierdo = Arrastrar Pokémon a donde quieras.
Clic central / Espacio (con un Pokémon agarrado) = Habilidad del Pokémon (flores, fuego, etc.)
Clic derecho = Mandar el Pokémon al centro / Vender un objeto
Flechas / A, S, D, W = Mover la vista
Enter / E = Abrir la tienda
Esc = Salir del juego

Re Pág / Av Pág = Más rápido / más lento
Fin / R = Ir a la zona central
T = Activar o desactivar el modo terreno
F1 = Ver esta ayuda
F2 = Reiniciar
F4 = Pantalla completa
F5 = Guardar (también en la tienda)
F6 = Cargar (también en la tienda)
F12 = Escribir un truco

Notas:
*Algunos Pokémon no tienen género. Para criar cuentan como cualquiera de los dos.
*Algunos Pokémon son demasiado grandes para la zona central. Si les haces clic derecho, no pasa nada.
*Los Pokémon pueden quedarse atascados en las vallas. Si pasa, sácalos arrastrándolos.
*En el modo terreno puedes mover el terreno. Actívalo o desactívalo en la tienda o con T.

Créditos:
*Gracias a Nintendo por crear Pokémon.
*Juego creado por Scott West (timeblade) y themaker.
*Gracias a Lehner por muchos gráficos.
*Gracias a coolbot4k, gobo, moltresflame, neopolis3 y onyxstar por los gráficos de algunos Pokémon.
*Gracias a peterrab por la pantalla de título.`;
