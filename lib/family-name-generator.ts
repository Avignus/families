const prefixes = [
  "Clã dos", "Ordem dos", "Guilda dos", "Legião dos", "Aliança dos",
  "Tribo dos", "Pacto dos", "Círculo dos", "Facção dos", "Sociedade dos",
];

const adjectives = [
  "Lendários", "Imortais", "Sombrios", "Eternos", "Caóticos",
  "Épicos", "Furiosos", "Invictos", "Místicos", "Supremos",
  "Temidos", "Gloriosos", "Infinitos", "Obscuros", "Forjados",
  "Amaldiçoados", "Abençoados", "Célebres", "Despietados", "Relentless",
];

const nouns = [
  "Heróis", "Guerreiros", "Dragões", "Caçadores", "Titãs",
  "Campeões", "Fantasmas", "Demônios", "Anjos", "Predadores",
  "Mercenários", "Paladinos", "Rangers", "Magos", "Berserkers",
  "Espadachins", "Arqueiros", "Assassinos", "Monges", "Templários",
];

const singles = [
  "Turma do Lag", "No Ping We Trust", "Respawn Família",
  "AFK por Amor", "GG Easy Fam", "Trolls Honestos",
  "Skip Tutorial", "Save & Quit", "Loot & Leave",
  "Speedrun Família", "Press Start", "Game Over Gang",
  "One More Match", "Final Boss Fam", "Checkpoint Squad",
  "Noscope Família", "Touch Grass Later", "Última Vida",
  "Full HP Gang", "Criticamente Famos",
];

export function generateFamilyName(): string {
  const pool = Math.random();

  if (pool < 0.25) {
    // Clã dos Lendários
    return `${pick(prefixes)} ${pick(adjectives)}`;
  } else if (pool < 0.50) {
    // Ordem dos Dragões
    return `${pick(prefixes)} ${pick(nouns)}`;
  } else if (pool < 0.65) {
    // Clã dos Dragões Eternos
    return `${pick(prefixes)} ${pick(nouns)} ${pick(adjectives)}`;
  } else {
    // Funny singles
    return pick(singles);
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
