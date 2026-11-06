// Générateur de noms fictifs par nationalité.
import { pick, rand } from '../core/util.js';

export const NATIONS = [
  { id: 'FR', name: 'France', region: 'Europe', first: ['Karim', 'Julien', 'Mehdi', 'Yanis', 'Lucas', 'Moussa', 'Thomas', 'Sofiane', 'Kevin', 'Bastien', 'Ibrahim', 'Hugo', 'Nordine', 'Enzo', 'Samuel'], last: ['Benali', 'Durand', 'Traoré', 'Lefèvre', 'Mercier', 'Haddad', 'Girard', 'Diallo', 'Rousseau', 'Morel', 'Fontaine', 'Camara', 'Lemoine', 'Bouaziz', 'Garnier'] },
  { id: 'US', name: 'États-Unis', region: 'Amérique', first: ['Marcus', 'Tyrell', 'Jake', 'DeShawn', 'Brandon', 'Isaiah', 'Cole', 'Jamal', 'Ryan', 'Andre', 'Terrence', 'Caleb', 'Darius', 'Wade', 'Lamont'], last: ['Jackson', 'Carter', 'Mitchell', 'Brooks', 'Hayes', 'Coleman', 'Porter', 'Reeves', 'Walker', 'Simmons', 'Bennett', 'Dawson', 'Fuller', 'Grant', 'Hollis'] },
  { id: 'MX', name: 'Mexique', region: 'Amérique', first: ['Jesús', 'Alejandro', 'Ramón', 'Luis', 'Miguel', 'Óscar', 'Saúl', 'Javier', 'Eduardo', 'Rafael', 'Erik', 'Héctor', 'Julio', 'Adrián'], last: ['Ramírez', 'Hernández', 'Castillo', 'Navarro', 'Ortega', 'Morales', 'Guzmán', 'Fuentes', 'Salazar', 'Vargas', 'Cárdenas', 'Rosales', 'Méndez'] },
  { id: 'GB', name: 'Royaume-Uni', region: 'Europe', first: ['Liam', 'Callum', 'Connor', 'Jamie', 'Reece', 'Tommy', 'Danny', 'Kyle', 'Owen', 'Harry', 'Lewis', 'Archie'], last: ['Turner', 'Walsh', 'Hughes', 'Price', 'Doyle', 'Fletcher', 'Barnes', 'Kelly', 'Shaw', 'Hartley', 'Booth', 'Riley'] },
  { id: 'PH', name: 'Philippines', region: 'Asie', first: ['Jerwin', 'Rey', 'Marlon', 'Jonas', 'Arnel', 'Romeo', 'Danilo', 'Jayson', 'Nonito', 'Mark'], last: ['Dela Cruz', 'Santos', 'Villanueva', 'Bautista', 'Magsayo', 'Ramos', 'Aquino', 'Mendoza', 'Tolentino'] },
  { id: 'JP', name: 'Japon', region: 'Asie', first: ['Takeshi', 'Ryota', 'Kenji', 'Daichi', 'Shun', 'Hiroto', 'Yuto', 'Kazuki', 'Sora', 'Haruki'], last: ['Takahashi', 'Nakamura', 'Ishikawa', 'Kobayashi', 'Fujimoto', 'Sakamoto', 'Morita', 'Okada', 'Yamaguchi'] },
  { id: 'UA', name: 'Ukraine', region: 'Europe', first: ['Oleksandr', 'Dmytro', 'Andriy', 'Taras', 'Bohdan', 'Serhiy', 'Vitaliy', 'Yaroslav'], last: ['Kovalenko', 'Shevchuk', 'Bondarenko', 'Melnyk', 'Tkachenko', 'Kravets', 'Polishchuk', 'Lysenko'] },
  { id: 'CU', name: 'Cuba', region: 'Amérique', first: ['Yordenis', 'Osmay', 'Erislandy', 'Yuniel', 'Robeisy', 'Lázaro', 'Andy', 'Yoenis'], last: ['Pérez', 'Arencibia', 'Batista', 'Rigondo', 'Correa', 'Despaigne', 'Iglesias', 'Toledo'] },
  { id: 'NG', name: 'Nigeria', region: 'Afrique', first: ['Chidi', 'Emeka', 'Tunde', 'Olumide', 'Segun', 'Ikenna', 'Babatunde', 'Kelechi'], last: ['Okafor', 'Adeyemi', 'Okonkwo', 'Balogun', 'Eze', 'Nwosu', 'Ogunleye', 'Afolabi'] },
  { id: 'KZ', name: 'Kazakhstan', region: 'Asie', first: ['Daniyar', 'Yerlan', 'Nurlan', 'Askhat', 'Bekzat', 'Zhanibek', 'Kanat'], last: ['Sadykov', 'Abenov', 'Zhumabayev', 'Iskakov', 'Tuleyev', 'Nurmagambet'] },
  { id: 'AR', name: 'Argentine', region: 'Amérique', first: ['Facundo', 'Matías', 'Lucas', 'Sergio', 'Brian', 'Marcos', 'Nahuel', 'Gastón'], last: ['Ferreyra', 'Acosta', 'Benítez', 'Quiroga', 'Sosa', 'Maidana', 'Paz', 'Ledesma'] },
  { id: 'PR', name: 'Porto Rico', region: 'Amérique', first: ['Félix', 'Héctor', 'Edwin', 'Xander', 'Wilfredo', 'Juan Carlos', 'Orlando'], last: ['Rivera', 'Colón', 'Báez', 'Figueroa', 'Santiago', 'Cotto', 'Rosario'] },
  { id: 'GH', name: 'Ghana', region: 'Afrique', first: ['Kwame', 'Kofi', 'Yaw', 'Kwesi', 'Ebo', 'Nana', 'Isaac'], last: ['Mensah', 'Asante', 'Boateng', 'Owusu', 'Addo', 'Quaye', 'Tetteh'] },
  { id: 'RU', name: 'Russie', region: 'Europe', first: ['Artur', 'Dmitri', 'Ruslan', 'Sergei', 'Maxim', 'Ilya', 'Denis'], last: ['Volkov', 'Morozov', 'Kuznetsov', 'Sokolov', 'Orlov', 'Belov', 'Gusev'] },
  { id: 'IT', name: 'Italie', region: 'Europe', first: ['Marco', 'Giovanni', 'Luca', 'Davide', 'Alessio', 'Matteo', 'Fabio'], last: ['Esposito', 'Romano', 'Ferraro', 'Bianchi', 'Galli', 'Rinaldi', 'Conti'] },
  { id: 'BR', name: 'Brésil', region: 'Amérique', first: ['Thiago', 'Rafael', 'Diego', 'Bruno', 'Wesley', 'Everton', 'Caio'], last: ['Silva', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Almeida', 'Rocha'] },
];

export const NICKNAMES = ['Le Marteau', 'Dynamite', 'El Toro', 'The Hammer', 'Bulldozer', 'La Foudre', 'Iceman', 'Kid Thunder', 'El Diablo', 'The Machine', 'Smooth', 'Fantôme', 'La Panthère', 'Cobra', 'The Bull', 'Hurricane', 'Scorpion', 'Double Trouble', 'Silent Storm', 'El Puño', 'Pitbull', 'Le Bûcheron', 'Showtime', 'The Prodigy', 'Mamba', 'Tank', 'Lionheart', 'The Viper', 'Cyclone', 'Chico Malo', 'Bad News', 'Le Sniper', 'Granite', 'Iron Fist', 'Wolf', 'The Surgeon', 'Le Gladiateur', 'Rocket', 'Venom', 'El Martillo'];

export function nationById(id) { return NATIONS.find((n) => n.id === id) || NATIONS[0]; }

export function randomName(nationId) {
  const n = nationId ? nationById(nationId) : pick(NATIONS);
  return { firstName: pick(n.first), lastName: pick(n.last), nationality: n.name, flag: n.id, region: n.region, nickname: rand() < 0.45 ? pick(NICKNAMES) : '' };
}
