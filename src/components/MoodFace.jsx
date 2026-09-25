/**
 * Les visages des humeurs, traces sur la planche qu'elle a choisie.
 *
 *   "Focus on the emotions, I don't see the new ones?"
 *
 * QUATRE SERIES DESSINEES A LA MAIN, ET AUCUNE N'ETAIT "LES NOUVEAUX".
 *
 * Mesurer sa reference et redessiner au compas a donne des visages proches,
 * jamais les siens. Ce qu'elle appelle "les nouveaux", c'est la planche
 * generee a partir de sa reference (Higgsfield, feuille A), celle qu'elle a
 * fait animer. Donc ce fichier ne dessine plus: il TRACE.
 *
 * COMMENT
 *
 * La planche (2048px) est decoupee en dix-huit cases. Dans chaque case, le
 * corps est la plus grande tache coloree; l'encre est ce qui est sombre
 * dedans, les blancs des yeux ce qui est blanc dedans. Chaque tache est
 * vectorisee (potrace, tolerance 0.9) et ramenee dans une boite de 100 de
 * large centree sur le corps. Les pupilles rondes deviennent des ellipses
 * (centre et rayons de leur boite), tout le reste garde son trace.
 *
 * Puis chaque visage est DEPLACE d'un bloc pour que le milieu de sa bande
 * (entre la ligne des yeux et la bouche) tombe a y=53 et son centre a x=50:
 * les corps de la planche ne sont pas ceux de l'application, et un visage
 * qui vivait en bas a droite d'un quart de cercle doit vivre au milieu du
 * notre. Les proportions internes ne sont pas touchees.
 *
 * CE QUI EST GARDE DES SERIES PRECEDENTES
 *
 *   - un groupe pour les yeux, un pour la bouche, chacun avec son animation
 *     (`fx`), parce que "I'd like their eyes to be animated too";
 *   - les larmes portent `mf-tear` pour tomber avec `fx-cry`;
 *   - dix-huit paires distinctes, et le test le verifie.
 *
 * "Confus" est le seul visage reconstruit a la main: dans sa case le trace a
 * attrape l'etiquette et le corps deborde de la grille. Ses deux blancs sont
 * bien traces; les pupilles sont posees dans leurs baies, et la bouche est
 * une petite vague.
 */

export const EYES = {
  joyful: (
    <g transform="translate(1.3 -1.2)">
      <path fill="#FFFFFF" d="M33.1 57.0C23.8 54.7 20.6 42.0 27.8 35.8C30.6 33.3 37.1 30.9 35.4 32.9C32.0 36.9 33.4 43.1 38.2 45.2C44.1 47.9 50.2 42.2 47.3 36.8C46.8 35.9 49.1 35.6 50.6 36.4C51.2 36.7 51.6 36.5 53.2 35.1C55.2 33.3 58.6 31.9 61.2 31.9C62.6 31.9 62.6 31.9 61.2 33.4C58.8 35.9 58.5 39.3 60.5 42.5C63.3 47.0 70.3 47.1 73.0 42.6C73.9 41.2 74.2 41.6 74.2 44.3C74.2 58.0 55.9 62.4 50.0 50.1C49.0 48.2 49.0 48.2 48.0 50.1C45.1 55.5 38.8 58.4 33.1 57.0Z" />
      <ellipse cx="40.6" cy="38.6" rx="7.2" ry="6.85" />
      <ellipse cx="66.4" cy="38.7" rx="7.2" ry="7" />
    </g>
  ),
  energized: (
    <g transform="translate(0.4 -1.3)">
      <path d="M32.0 51.8C27.9 50.7 24.7 47.4 24.7 44.2C24.7 42.0 27.6 41.8 28.0 43.9C29.4 50.1 38.6 50.5 42.0 44.5C44.0 40.9 47.3 41.6 45.7 45.3C43.7 50.0 37.1 53.2 32.0 51.8Z" />
      <path d="M60.1 51.6C56.5 50.5 53.3 46.9 53.3 44.1C53.3 41.6 56.2 42.0 57.1 44.5C59.1 50.4 68.7 50.1 71.1 44.0C72.0 41.8 74.9 41.6 74.9 43.8C74.9 48.8 66.1 53.5 60.1 51.6Z" />
    </g>
  ),
  excited: (
    <g transform="translate(0.7 2.1)">
      <path fill="#FFFFFF" d="M32.7 53.5C20.8 49.8 22.7 30.9 35.1 29.3C36.6 29.1 36.6 29.1 35.5 30.5C32.3 34.6 33.7 40.2 38.5 42.5C44.5 45.5 50.9 39.6 48.0 33.9C47.4 32.7 48.7 32.2 50.0 33.1C50.7 33.6 50.9 33.5 52.5 31.8C54.6 29.6 57.4 28.2 60.6 27.9C63.0 27.6 63.0 27.6 61.8 28.7C55.5 34.7 62.4 45.2 70.3 41.6C71.7 41.0 73.7 39.0 73.7 38.3C73.7 38.1 73.9 38.0 74.1 38.0C75.4 38.0 73.9 45.1 71.9 47.9C66.8 55.5 54.3 54.5 50.1 46.3C49.2 44.4 49.2 44.4 48.1 46.8C45.4 52.6 38.8 55.4 32.7 53.5Z" />
      <ellipse cx="41.1" cy="35.8" rx="7.3" ry="7.1" />
      <ellipse cx="66.6" cy="34.7" rx="7.3" ry="7.1" />
    </g>
  ),
  grateful: (
    <g transform="translate(0.9 -2.2)">
      <path d="M30.9 53.0C26.3 51.4 22.9 45.4 26.2 44.4C27.2 44.0 27.6 44.4 28.5 46.5C31.0 52.2 39.1 51.5 41.6 45.4C42.3 43.9 44.0 43.6 44.8 45.0C45.6 46.5 42.9 50.7 40.2 52.1C38.2 53.1 32.8 53.6 30.9 53.0Z" />
      <path d="M60.4 53.6C56.6 52.9 54.3 50.7 53.7 47.2C53.2 44.7 56.3 43.5 56.9 45.9C58.5 52.4 67.6 52.3 70.3 45.8C70.9 44.4 71.4 44.0 72.6 44.3C75.0 44.9 72.9 49.9 69.4 52.1C66.7 53.8 63.7 54.3 60.4 53.6Z" />
    </g>
  ),
  serene: (
    <g transform="translate(-0.8 -3.8)">
      <path d="M33.2 54.3C29.9 53.4 27.2 50.5 27.2 47.7C27.1 45.0 29.3 44.8 30.0 47.4C31.6 53.0 39.7 53.1 42.8 47.6C44.1 45.4 44.4 45.2 45.7 45.6C48.2 46.6 44.7 52.1 40.5 53.9C38.6 54.7 35.2 54.9 33.2 54.3Z" />
      <path d="M62.9 54.4C58.6 53.6 54.2 48.6 55.6 46.4C56.1 45.6 57.9 45.6 58.3 46.3C60.4 50.8 61.0 51.3 64.9 51.3C68.3 51.3 70.0 50.3 71.5 47.4C73.4 43.7 76.4 44.9 74.5 48.7C72.6 52.8 67.4 55.3 62.9 54.4Z" />
    </g>
  ),
  neutral: (
    <g transform="translate(-0.8 -1.9)">
      <path fill="#FFFFFF" d="M35.8 57.2C21.2 54.7 21.5 33.6 36.2 31.0C37.5 30.7 37.5 30.7 36.5 31.8C32.1 36.4 36.1 44.7 42.7 44.7C45.8 44.7 49.2 42.3 49.7 39.7C49.9 38.9 50.1 38.7 50.6 38.9C51.0 39.0 51.3 38.8 51.5 38.2C52.1 35.6 58.0 31.1 60.8 31.1C61.8 31.1 61.8 31.1 60.9 32.7C58.5 37.1 60.2 41.9 64.7 44.0C68.8 45.9 73.8 43.5 74.9 39.2C75.4 37.4 75.4 37.4 76.2 39.6C81.8 54.6 59.3 64.6 51.7 50.4C50.7 48.4 50.7 48.4 49.8 50.1C48.3 53.3 44.2 56.4 40.9 57.0C38.1 57.4 37.5 57.5 35.8 57.2Z" />
      <ellipse cx="42.1" cy="37.2" rx="7.55" ry="7" />
      <ellipse cx="67.2" cy="37.2" rx="7.35" ry="7" />
    </g>
  ),
  nostalgic: (
    <g transform="translate(-4.5 -16.2)">
      <path fill="#FFFFFF" d="M37.7 73.5C32.2 71.9 28.5 67.8 28.0 62.6C27.8 60.6 27.8 60.6 29.4 61.7C32.3 63.6 35.4 63.5 38.4 61.3C42.3 58.3 42.2 51.4 38.2 48.9C36.3 47.7 37.2 47.2 41.1 47.2C47.5 47.3 53.1 51.4 54.1 56.9C55.1 62.5 62.8 63.2 66.5 57.9C69.0 54.6 68.0 49.0 64.7 47.1C63.2 46.2 64.0 45.9 68.0 45.8C80.0 45.6 85.6 60.5 76.9 69.2C70.9 75.2 58.7 73.2 55.4 65.7C54.4 63.6 54.1 63.5 53.5 65.6C51.8 71.1 43.7 75.2 37.7 73.5Z" />
      <ellipse cx="34.2" cy="55.3" rx="6.9" ry="7.3" />
      <ellipse cx="60.7" cy="53.4" rx="6.7" ry="7.5" />
    </g>
  ),
  sensitive: (
    <g transform="translate(0.3 -5.1)">
      <path d="M31.4 55.4C27.9 54.0 24.9 48.7 26.7 47.2C27.7 46.4 28.5 47.0 29.7 49.2C32.2 54.2 39.3 53.8 41.1 48.4C41.7 46.4 44.4 46.4 44.4 48.4C44.4 53.0 36.3 57.3 31.4 55.4Z" />
      <path d="M59.8 55.0C56.2 53.2 53.6 47.9 55.9 47.0C56.9 46.6 57.6 47.2 58.6 49.1C61.1 54.5 67.4 53.9 70.6 48.0C72.0 45.4 74.5 47.1 73.3 49.8C71.0 54.9 64.6 57.4 59.8 55.0Z" />
      <path className="mf-tear" fill="#FFFFFF" d="M31.7 69.0C28.5 67.7 28.4 64.6 31.5 59.2C33.3 55.9 33.1 55.8 35.2 60.0C38.2 65.8 36.2 70.8 31.7 69.0Z" />
    </g>
  ),
  bored: (
    <g transform="translate(0 -5.3)">
      <path fill="#FFFFFF" d="M32.6 60.3C21.7 57.3 18.3 42.8 27.5 38.2C29.4 37.2 29.4 37.2 29.6 39.8C30.4 50.1 44.4 50.5 45.6 40.3C45.7 39.2 45.9 38.4 46.1 38.4C46.8 38.4 48.7 41.3 49.3 43.2C49.9 45.1 50.6 45.8 50.6 44.5C50.6 42.5 53.1 38.9 55.8 37.1C57.2 36.2 57.3 36.3 57.3 39.0C57.3 41.7 58.0 43.7 59.5 45.3C64.6 50.6 73.1 46.8 73.1 39.3C73.1 37.3 73.1 37.3 74.6 38.5C80.9 43.6 78.5 55.1 70.3 59.2C62.0 63.2 54.3 59.8 50.3 50.4C50.0 49.7 49.8 49.6 49.7 50.0C48.4 53.8 48.0 54.5 46.1 56.4C42.3 60.2 37.3 61.6 32.6 60.3Z" />
      <path d="M34.3 46.9C31.3 45.5 29.1 41.1 29.9 38.0C30.2 36.7 30.2 36.7 37.2 36.6C45.3 36.5 45.3 36.5 45.3 39.3C45.3 45.1 39.3 49.2 34.3 46.9Z" />
      <ellipse cx="65" cy="41" rx="7.85" ry="6.2" />
    </g>
  ),
  sick: (
    <g transform="translate(0.8 -8.6)">
      <path d="M24.8 59.9C24.5 59.6 24.4 59.0 24.6 58.4C24.8 57.4 24.7 57.5 32.0 55.5C35.6 54.4 35.6 54.5 33.3 53.3C27.4 50.4 25.9 49.3 26.0 48.1C26.2 46.2 27.3 46.5 34.8 50.3C41.8 53.9 41.8 53.9 41.8 55.2C41.8 56.5 41.8 56.5 38.7 57.2C37.1 57.5 33.4 58.4 30.7 59.2C24.8 60.7 25.4 60.6 24.8 59.9Z" />
      <path d="M69.3 58.9C67.4 58.5 63.9 57.9 61.5 57.4C55.5 56.4 54.5 55.2 58.0 53.3C59.0 52.8 62.4 50.9 65.6 49.1C71.9 45.7 72.7 45.5 72.7 47.8C72.7 48.8 72.3 49.1 68.0 51.5C65.3 53.0 63.6 54.3 63.8 54.4C64.1 54.5 66.6 55.1 69.4 55.7C74.7 56.8 75.1 57.1 74.7 58.8C74.4 59.9 74.0 59.9 69.3 58.9Z" />
    </g>
  ),
  confused: (
    <g transform="translate(-0.7 -2.2)">
      <path fill="#FFFFFF" d="M34.9 60.2C28.8 58.3 25.4 53.6 25.7 47.3C26.2 38.4 35.0 32.7 43.2 35.9C46.6 37.2 47.4 38.2 45.1 38.2C40.1 38.2 37.0 44.0 39.8 48.2C41.6 50.9 45.4 51.8 48.2 50.2C51.7 48.2 49.5 54.8 45.7 57.6C42.4 60.1 38.1 61.1 34.9 60.2Z" />
      <path fill="#FFFFFF" d="M59.9 61.1C56.8 60.2 53.7 58.0 52.4 55.5C52.0 54.7 52.2 54.6 53.4 55.3C56.3 57.0 61.1 54.9 62.3 51.4C64.0 46.3 58.6 41.2 53.6 43.2C52.3 43.7 52.2 43.4 53.3 41.8C57.2 35.9 67.7 35.4 72.6 41.0C80.4 49.8 71.3 64.3 59.9 61.1Z" />
      <ellipse cx="45.6" cy="44.2" rx="6.2" ry="6.4" />
      <ellipse cx="57.6" cy="49.2" rx="6.3" ry="6.5" />
    </g>
  ),
  insecure: (
    <g transform="translate(-1 -4.2)">
      <path fill="#FFFFFF" d="M35.0 61.5C30.1 60.5 26.5 57.4 25.1 53.1C24.8 52.2 24.9 52.2 25.8 52.8C29.8 55.4 36.6 51.1 36.6 45.8C36.6 41.9 33.6 38.0 30.5 37.9C28.9 37.9 33.0 36.1 35.7 35.6C42.4 34.5 50.4 40.2 48.9 45.1C48.1 47.6 47.9 51.0 48.2 53.8C48.7 57.2 45.2 60.8 40.6 61.5C39.7 61.6 38.7 61.8 38.3 61.9C37.9 61.9 36.4 61.8 35.0 61.5Z" />
      <path fill="#FFFFFF" d="M56.1 57.7C55.5 57.5 55.7 57.3 56.9 56.2C59.5 54.0 60.3 49.7 58.7 46.6C58.0 45.2 55.8 43.2 55.1 43.2C54.8 43.2 54.7 43.1 54.7 43.0C55.0 42.8 74.0 41.2 74.5 41.5C75.9 42.0 76.2 52.7 75.0 56.2C74.5 57.7 74.5 57.7 65.7 57.8C60.8 57.8 56.5 57.8 56.1 57.7Z" />
      <ellipse cx="29.4" cy="45.7" rx="6.6" ry="7.55" />
      <path d="M51.6 57.6C48.9 57.5 48.8 57.2 48.4 52.7C48.2 49.0 49.0 43.8 50.0 43.5C58.2 40.3 63.0 52.2 55.4 57.0C54.6 57.5 53.9 57.9 53.9 57.9C53.8 57.8 52.8 57.7 51.6 57.6Z" />
    </g>
  ),
  stressed: (
    <g transform="translate(-0.2 6.3)">
      <path d="M28.2 44.5C27.5 43.1 28.4 42.2 31.4 41.3C39.3 39.0 39.1 39.3 34.5 36.9C29.5 34.2 29.0 33.7 29.9 32.4C30.8 31.0 30.7 30.9 38.5 35.0C47.7 39.9 47.9 40.6 40.4 42.2C38.2 42.8 34.8 43.6 32.9 44.2C28.9 45.4 28.7 45.4 28.2 44.5Z" />
      <path d="M68.8 43.8C67.5 43.5 64.0 42.8 61.0 42.3C58.0 41.7 55.3 41.2 55.1 41.1C54.4 40.6 54.7 38.9 55.7 38.4C59.5 36.0 69.5 30.6 70.0 30.6C70.7 30.6 71.4 31.4 71.4 32.4C71.4 33.3 71.5 33.3 65.5 36.7C61.6 38.9 61.5 38.7 68.4 40.3C72.6 41.2 73.0 41.4 73.3 42.3C73.8 44.4 72.7 44.7 68.8 43.8Z" />
    </g>
  ),
  angry: (
    <g transform="translate(0.2 1)">
      <path fill="#FFFFFF" d="M32.9 50.7C27.4 48.7 23.9 44.1 23.9 38.6C23.8 36.6 23.8 36.6 27.2 36.6C30.7 36.5 30.7 36.5 31.1 38.5C32.9 46.0 43.8 45.4 43.8 37.7C43.8 36.5 43.8 36.5 49.8 36.5C55.8 36.5 55.8 36.5 56.0 38.2C57.3 46.0 68.8 45.5 68.8 37.6C68.8 36.5 70.0 36.1 73.9 36.1C76.4 36.1 76.6 36.6 75.1 41.4C72.1 51.3 59.8 54.6 52.6 47.4C51.3 46.1 50.4 44.8 50.2 44.0C49.8 42.2 49.3 42.2 48.5 44.0C46.1 49.4 38.5 52.7 32.9 50.7Z" />
      <path d="M35.9 43.6C33.3 42.8 31.2 40.1 31.2 37.4C31.2 36.0 33.7 35.6 39.8 36.0C43.4 36.3 43.4 36.3 43.3 38.1C42.9 41.9 39.2 44.6 35.9 43.6Z" />
      <path d="M59.1 42.8C57.6 41.9 56.3 39.3 56.3 37.5C56.2 36.0 57.7 35.7 64.7 35.7C68.4 35.7 68.4 35.7 68.4 37.4C68.4 42.1 63.0 45.2 59.1 42.8Z" />
    </g>
  ),
  discouraged: (
    <g transform="translate(0 -5)">
      <path fill="#FFFFFF" d="M33.9 57.6C28.5 56.0 24.4 50.8 24.3 45.1C24.3 43.0 24.3 43.0 27.7 43.0C30.9 43.0 31.1 43.1 31.1 43.9C31.2 51.7 42.2 52.5 43.9 44.8C44.3 42.6 44.3 42.6 50.3 42.6C56.2 42.6 56.2 42.6 56.2 43.7C56.2 45.4 57.8 48.3 59.4 49.3C63.2 51.9 68.9 48.7 68.9 43.9C68.9 42.7 68.9 42.7 72.3 42.4C76.4 42.1 76.3 42.0 75.8 45.2C73.4 59.4 55.1 62.8 50.8 49.8C50.0 47.3 49.7 47.3 48.8 49.8C46.7 55.7 39.9 59.2 33.9 57.6Z" />
      <path d="M35.3 49.7C32.9 48.6 31.5 46.2 31.5 43.3C31.5 42.2 31.5 42.2 37.7 42.2C43.9 42.2 43.9 42.2 43.7 44.1C43.1 48.6 38.9 51.3 35.3 49.7Z" />
      <path d="M61.2 49.9C58.7 49.3 56.6 46.4 56.6 43.7C56.6 42.1 57.7 41.8 64.6 41.8C68.3 41.8 68.5 41.9 68.6 42.7C69.3 46.9 65.0 50.9 61.2 49.9Z" />
    </g>
  ),
  sad: (
    <g transform="translate(1.1 -5.4)">
      <path fill="#FFFFFF" d="M33.3 62.0C22.0 58.8 20.7 43.3 31.3 38.1C34.7 36.4 41.2 36.3 38.0 38.0C31.8 41.2 34.8 51.6 41.8 51.0C47.7 50.5 50.2 45.0 46.5 40.4C45.6 39.2 45.7 39.2 49.5 40.0C52.3 40.5 52.3 40.5 54.0 39.2C56.3 37.5 60.3 36.3 62.5 36.6C64.2 36.8 65.0 37.2 64.3 37.4C60.7 38.7 58.9 43.4 60.6 46.9C63.4 52.3 71.4 52.0 73.6 46.3C74.3 44.5 74.5 49.6 73.9 53.5C73.2 58.5 71.3 60.8 67.7 61.2C67.0 61.2 65.5 61.5 64.3 61.7C58.5 62.9 52.5 60.0 50.1 54.8C49.1 52.5 49.1 52.5 47.9 55.1C45.4 60.4 38.8 63.5 33.3 62.0Z" />
      <ellipse cx="41.2" cy="43.8" rx="6.6" ry="6.8" />
      <ellipse cx="66.7" cy="43.8" rx="6.8" ry="6.8" />
      <path className="mf-tear" fill="#FFFFFF" d="M64.9 73.3C63.1 71.7 64.1 66.7 67.1 62.7C67.9 61.6 70.8 67.4 70.9 70.3C70.9 73.8 67.6 75.5 64.9 73.3Z" />
    </g>
  ),
  hurt: (
    <g transform="translate(0 -1.8)">
      <path d="M35.2 51.7C31.6 51.0 27.9 46.9 28.6 44.6C29.2 42.9 31.2 43.4 31.6 45.3C32.7 50.2 40.4 50.2 43.1 45.2C44.5 42.7 46.8 43.0 46.3 45.7C45.4 49.4 39.6 52.6 35.2 51.7Z" />
      <path d="M59.3 51.5C55.3 50.2 52.0 45.1 54.3 43.8C55.2 43.3 56.6 43.9 56.6 44.8C56.6 50.0 64.8 50.4 68.0 45.5C69.9 42.5 72.5 43.1 71.1 46.2C69.0 50.5 63.7 53.0 59.3 51.5Z" />
    </g>
  ),
  guilty: (
    <g transform="translate(-10.5 -18.9)">
      <path fill="#FFFFFF" d="M45.1 74.8C42.9 74.4 42.9 74.4 44.7 73.5C49.1 71.3 50.8 65.5 48.0 62.6C45.2 59.7 41.1 59.2 38.2 61.5C35.8 63.4 37.0 61.8 40.3 58.7C48.8 50.5 48.1 51.0 51.0 51.7C56.4 53.1 61.3 59.3 59.9 63.0C59.7 63.4 59.5 64.5 59.3 65.6C58.1 71.9 51.6 76.1 45.1 74.8Z" />
      <path fill="#FFFFFF" d="M70.2 75.1C69.9 75.0 69.1 74.8 68.2 74.7C66.7 74.4 66.7 74.4 68.6 73.5C71.8 72.0 73.5 69.5 73.5 66.1C73.5 61.3 67.0 58.0 62.7 60.6C60.6 61.8 60.9 61.1 64.5 56.7C69.9 50.0 69.0 50.5 72.4 51.8C82.8 55.5 84.4 57.0 84.4 62.6C84.3 69.7 75.9 77.1 70.2 75.1Z" />
      <ellipse cx="42.1" cy="67" rx="6.7" ry="6.9" />
      <ellipse cx="64.6" cy="66.8" rx="8.3" ry="7.1" />
    </g>
  ),
}

export const MOUTHS = {
  joyful: (
    <g transform="translate(1.3 -1.2)">
      <path d="M45.4 67.7C41.6 66.2 38.8 60.5 41.9 60.5C42.7 60.5 43.1 60.8 43.7 62.0C45.8 65.9 51.0 66.2 53.4 62.5C55.1 59.9 55.2 59.9 56.0 60.1C58.5 60.9 56.0 65.6 52.2 67.4C50.6 68.1 46.9 68.3 45.4 67.7Z" />
    </g>
  ),
  energized: (
    <g transform="translate(0.4 -1.3)">
      <path d="M46.3 66.7C42.0 65.8 38.8 63.2 38.0 60.0C37.2 56.4 37.1 56.5 49.2 56.5C60.1 56.5 60.5 56.5 60.5 58.4C60.3 63.6 52.8 68.0 46.3 66.7Z" />
    </g>
  ),
  excited: (
    <g transform="translate(0.7 2.1)">
      <path d="M46.6 66.4C43.8 65.5 41.3 62.0 41.2 58.9C41.2 56.2 41.2 56.2 49.7 56.0C58.4 55.7 58.2 55.7 58.0 58.9C57.5 64.3 51.8 68.1 46.6 66.4Z" />
    </g>
  ),
  grateful: (
    <g transform="translate(0.9 -2.2)">
      <path d="M44.2 64.9C39.5 63.4 36.2 59.6 38.5 58.4C39.5 57.9 39.4 57.8 41.3 59.6C45.5 63.6 52.6 63.5 56.6 59.4C58.2 57.8 58.6 57.7 59.6 58.7C60.6 59.7 59.9 61.1 57.4 62.9C53.9 65.5 48.6 66.3 44.2 64.9Z" />
    </g>
  ),
  serene: (
    <g transform="translate(-0.8 -3.8)">
      <path d="M46.5 67.0C43.2 65.5 40.9 62.3 42.1 60.9C42.8 60.0 44.2 60.2 44.8 61.4C46.9 65.5 51.7 65.9 55.2 62.3C57.9 59.6 60.4 60.0 58.9 62.8C56.8 66.8 50.6 68.9 46.5 67.0Z" />
    </g>
  ),
  neutral: (
    <g transform="translate(-0.8 -1.9)">
      <path d="M41.7 66.9C40.1 64.6 41.1 64.3 50.7 64.3C59.9 64.3 60.3 64.4 59.9 66.4C59.4 68.0 42.8 68.5 41.7 66.9Z" />
    </g>
  ),
  nostalgic: (
    <g transform="translate(-4.5 -16.2)">
      <path d="M49.6 81.7C46.7 80.0 45.3 77.0 47.0 76.1C48.1 75.5 48.9 75.9 49.4 77.1C50.7 80.4 56.4 80.4 58.4 77.1C60.1 74.1 63.0 75.4 61.4 78.5C59.4 82.2 53.5 83.9 49.6 81.7Z" />
    </g>
  ),
  sensitive: (
    <g transform="translate(0.3 -5.1)">
      <path d="M43.3 67.4C42.6 66.0 44.6 63.8 47.5 62.9C50.5 61.9 54.6 63.3 56.2 65.6C57.5 67.7 55.1 69.0 53.4 67.2C51.4 65.1 48.7 65.0 46.5 67.0C45.1 68.2 43.8 68.4 43.3 67.4Z" />
    </g>
  ),
  bored: (
    <g transform="translate(0 -5.3)">
      <path d="M40.9 69.4C40.7 69.2 40.4 68.6 40.4 68.2C40.4 66.6 40.9 66.5 50.0 66.5C59.1 66.5 59.9 66.6 59.9 68.2C59.9 69.8 42.4 70.9 40.9 69.4Z" />
    </g>
  ),
  sick: (
    <g transform="translate(0.8 -8.6)">
      <path d="M47.7 73.7C47.2 73.4 46.4 73.1 46.0 73.1C45.5 73.1 44.3 72.5 43.3 71.7C41.5 70.3 41.5 70.3 40.1 71.9C37.4 75.1 35.6 73.0 38.0 69.4C40.0 66.3 42.2 66.0 44.5 68.5C45.9 70.1 46.5 70.2 47.6 68.9C48.8 67.5 50.3 67.4 51.5 68.7C52.4 69.6 52.4 69.6 53.5 68.8C57.6 65.7 58.9 65.9 61.5 70.0C63.4 73.0 60.9 74.6 58.9 71.6C57.7 69.7 57.4 69.7 55.3 71.3C52.3 73.7 49.3 74.6 47.7 73.7Z" />
    </g>
  ),
  confused: (
    <g transform="translate(-0.7 -2.2)">
      <path d="M42.4 65.8C41.2 64.2 43.6 62.4 46.4 63.0C48.4 63.4 49.8 63.2 51.4 62.3C54.4 60.6 57.6 61.2 58.6 63.2C59.4 64.8 57.6 65.8 56.2 64.6C54.8 63.4 53.2 63.6 51.4 64.7C49.0 66.1 46.6 66.2 44.6 65.4C43.6 65.0 43.0 66.6 42.4 65.8Z" />
    </g>
  ),
  insecure: (
    <g transform="translate(-1 -4.2)">
      <path d="M43.8 67.1C42.8 65.2 43.6 64.8 49.6 64.5C54.3 64.2 54.3 64.2 54.6 65.3C55.0 67.0 54.3 67.3 49.0 67.6C44.4 67.8 44.2 67.8 43.8 67.1Z" />
    </g>
  ),
  stressed: (
    <g transform="translate(-0.2 6.3)">
      <path d="M49.3 59.6C49.0 59.4 48.0 59.3 47.2 59.4C45.5 59.6 43.5 58.6 42.2 57.0C40.9 55.4 40.6 55.5 39.3 57.5C38.0 59.6 37.1 60.0 35.9 58.9C35.1 58.0 35.1 57.8 36.7 55.4C39.2 51.4 41.0 51.1 44.1 54.2C46.2 56.3 46.2 56.3 48.0 54.4C49.9 52.3 51.1 52.3 53.3 54.3C54.9 55.9 54.9 55.9 57.2 53.9C60.2 51.4 61.4 51.4 63.5 53.5C65.9 56.0 66.6 57.7 65.7 58.7C64.6 59.9 64.0 59.7 62.5 57.5C60.7 55.1 60.9 55.1 58.3 57.4C56.3 59.1 56.0 59.2 54.4 59.0C53.2 58.9 52.3 59.0 51.8 59.4C50.9 60.0 50.1 60.1 49.3 59.6Z" />
    </g>
  ),
  angry: (
    <g transform="translate(0.2 1)">
      <path d="M39.5 63.8C37.1 61.3 45.5 56.3 50.9 57.0C55.8 57.7 61.1 62.0 59.3 63.8C58.5 64.6 57.4 64.3 55.7 62.7C52.0 59.4 46.1 59.5 42.8 63.0C41.6 64.3 40.3 64.6 39.5 63.8Z" />
    </g>
  ),
  discouraged: (
    <g transform="translate(0 -5)">
      <path d="M42.1 69.3C40.2 68.2 42.8 64.8 46.6 63.6C51.3 62.0 59.4 65.3 58.4 68.5C57.9 69.9 56.7 69.9 55.0 68.4C51.8 65.7 48.2 65.7 45.0 68.3C43.2 69.9 43.1 69.9 42.1 69.3Z" />
    </g>
  ),
  sad: (
    <g transform="translate(1.1 -5.4)">
      <path d="M41.4 70.7C39.5 68.4 45.4 63.6 49.4 64.2C53.3 64.8 57.3 69.1 55.6 70.8C54.8 71.7 53.6 71.3 52.8 70.0C50.7 66.4 46.4 66.4 44.3 70.0C43.5 71.4 42.2 71.7 41.4 70.7Z" />
    </g>
  ),
  hurt: (
    <g transform="translate(0 -1.8)">
      <path d="M38.0 64.2C35.3 61.5 42.3 58.8 46.6 60.9C48.7 62.0 48.7 62.0 50.8 60.9C54.1 59.2 56.6 59.5 60.0 61.9C62.5 63.6 60.4 65.5 57.7 64.0C55.4 62.7 54.1 62.7 51.7 63.9C49.4 65.0 48.3 65.0 45.5 63.8C43.1 62.8 43.1 62.8 41.2 63.8C38.9 65.0 38.8 65.0 38.0 64.2Z" />
    </g>
  ),
  guilty: (
    <g transform="translate(-10.5 -18.9)">
      <path d="M51.9 83.8C51.2 81.9 54.1 78.3 56.7 77.8C59.6 77.3 63.0 80.3 62.8 83.0C62.6 84.3 61.1 84.9 60.3 83.9C59.6 82.9 55.0 82.8 54.5 83.7C54.0 84.5 52.2 84.6 51.9 83.8Z" />
    </g>
  ),
}

/**
 * QUEL VISAGE POUR QUELLE HUMEUR.
 *
 * Ici et pas dans MOODS, parce que MOODS est la liste que la base et les
 * traductions connaissent, et parce que c'est cette table-ci que le test
 * compare a elle-meme pour garantir que deux humeurs ne portent pas le meme
 * visage. Une humeur ajoutee au catalogue et oubliee ici ne prend pas le
 * visage d'une autre en silence: elle n'en a pas, et le test le dit.
 *
 * Chaque humeur porte son propre trace, donc les noms sont ceux des humeurs.
 *
 * `fx` est ce qui BOUGE quand on la touche, feature par feature. C'est la
 * demande: "I meant everything on the sticker, I'd like their eyes to be
 * animated too". Le corps garde son propre geste (MOOD_MOTION), les yeux et
 * la bouche ont le leur, et les trois jouent ensemble. "Confus" roule des
 * yeux au lieu de tourner: la spirale a disparu avec la planche, et une paire
 * d'yeux blancs qui pivote de 360 degres n'est pas de la confusion.
 */
export const FACES = {
  joyful: { eyes: 'joyful', mouth: 'joyful', fx: { eyes: 'fx-squeeze', mouth: 'fx-open' } },
  energized: { eyes: 'energized', mouth: 'energized', fx: { eyes: 'fx-flash', mouth: 'fx-open' } },
  excited: { eyes: 'excited', mouth: 'excited', fx: { eyes: 'fx-widen', mouth: 'fx-gasp' } },
  grateful: { eyes: 'grateful', mouth: 'grateful', fx: { eyes: 'fx-blink', mouth: 'fx-lift' } },
  serene: { eyes: 'serene', mouth: 'serene', fx: { eyes: 'fx-settle', mouth: 'fx-lift' } },
  neutral: { eyes: 'neutral', mouth: 'neutral', fx: { eyes: 'fx-blink', mouth: 'fx-nudge' } },
  nostalgic: { eyes: 'nostalgic', mouth: 'nostalgic', fx: { eyes: 'fx-glance', mouth: 'fx-lift' } },
  sensitive: { eyes: 'sensitive', mouth: 'sensitive', fx: { eyes: 'fx-well', mouth: 'fx-tremble' } },
  bored: { eyes: 'bored', mouth: 'bored', fx: { eyes: 'fx-glancedown', mouth: 'fx-nudge' } },
  sick: { eyes: 'sick', mouth: 'sick', fx: { eyes: 'fx-roll', mouth: 'fx-tremble' } },
  confused: { eyes: 'confused', mouth: 'confused', fx: { eyes: 'fx-roll', mouth: 'fx-nudge' } },
  insecure: { eyes: 'insecure', mouth: 'insecure', fx: { eyes: 'fx-shrinkface', mouth: 'fx-shrinkface' } },
  stressed: { eyes: 'stressed', mouth: 'stressed', fx: { eyes: 'fx-tense', mouth: 'fx-clench' } },
  angry: { eyes: 'angry', mouth: 'angry', fx: { eyes: 'fx-tense', mouth: 'fx-clench' } },
  discouraged: { eyes: 'discouraged', mouth: 'discouraged', fx: { eyes: 'fx-droop', mouth: 'fx-fall' } },
  sad: { eyes: 'sad', mouth: 'sad', fx: { eyes: 'fx-cry', mouth: 'fx-fall' } },
  hurt: { eyes: 'hurt', mouth: 'hurt', fx: { eyes: 'fx-squeeze', mouth: 'fx-tremble' } },
  guilty: { eyes: 'guilty', mouth: 'guilty', fx: { eyes: 'fx-glancedown', mouth: 'fx-nudge' } },
}

export const faceOf = (id) => FACES[id] ?? null

/**
 * Le visage d'une humeur, anime ou au repos.
 *
 * `playing` porte les classes d'animation sur les DEUX groupes plutot que sur
 * le svg entier, ce qui est toute la difference entre "le sticker bouge" et
 * "le visage fait l'emotion".
 *
 * Tout est PLEIN: les traces sont des formes, pas des traits. Les blancs des
 * yeux disent leur couleur eux-memes; le reste herite de l'encre du groupe.
 *
 * Les classes sont des chaines ENTIERES dans la table ci-dessus. Tailwind lit
 * le texte des sources, donc `fx-${quelquechose}` ne produit aucune classe au
 * build; ce sont des classes a nous dans index.css, mais la regle du projet
 * vaut quand meme et elle vaut deux fois pour une table.
 */
export default function MoodGlyph({ mood, playing = false }) {
  const face = faceOf(mood?.id)
  const eyes = EYES[face?.eyes] ?? EYES.neutral
  const mouth = MOUTHS[face?.mouth] ?? MOUTHS.neutral

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <path
        d={mood.path}
        fill={mood.color}
        stroke={mood.color}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <g fill="#141216" stroke="none">
        <g className={`mf-eyes ${playing ? face?.fx?.eyes ?? '' : ''}`}>{eyes}</g>
        <g className={`mf-mouth ${playing ? face?.fx?.mouth ?? '' : ''}`}>{mouth}</g>
      </g>
    </svg>
  )
}
