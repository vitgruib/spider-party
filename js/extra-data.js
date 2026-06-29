// ============================================================
//  Manually-authored extra word lists.
//  Kept separate from data.js (which is auto-generated) so these
//  survive a regenerate. Merged into the category list at runtime.
//  Only the categories referenced by the curated set in store.js are
//  surfaced in the UI.
//  Shape matches headsUpCategories: { name, emoji, primary, secondary, words }
// ============================================================
// Wavelength spectrums: each is a pair of opposite concepts [leftEnd, rightEnd].
export const wavelengthPairs = [
  ['Cold', 'Hot'],
  ['Bad', 'Good'],
  ['Cheap', 'Expensive'],
  ['Underrated', 'Overrated'],
  ['Useless', 'Useful'],
  ['Unhealthy', 'Healthy'],
  ['Common', 'Rare'],
  ['Boring', 'Exciting'],
  ['Scary', 'Comforting'],
  ['Old', 'Modern'],
  ['Quiet', 'Loud'],
  ['Weak', 'Strong'],
  ['Ugly', 'Beautiful'],
  ['Casual', 'Formal'],
  ['Small', 'Huge'],
  ['Simple', 'Complicated'],
  ['Sad', 'Happy'],
  ['Normal', 'Weird'],
  ['Forgettable', 'Iconic'],
  ['Guilty pleasure', 'Universally loved'],
  ['Easy', 'Hard'],
  ['Introvert', 'Extrovert'],
  ['Overrated food', 'Underrated food'],
  ['Waste of money', 'Worth it'],
  ['Dangerous', 'Safe'],
  ['Messy', 'Tidy'],
  ['Childish', 'Mature'],
  ['Temporary', 'Permanent'],
  ['Basic', 'Fancy'],
  ['Low effort', 'High effort'],
  ['Quiet night in', 'Wild night out'],
  ['A want', 'A need'],
  ['Fictional', 'Real'],
  ['Smells bad', 'Smells great'],
  ['Round', 'Pointy'],
];

export const extraCategories = [
  {
    name: 'Sports',
    emoji: '🏀',
    primary: '#FF6F00',
    secondary: '#E65100',
    words: [
      'Basketball', 'Soccer', 'Football', 'Baseball', 'Tennis', 'Golf', 'Hockey',
      'Volleyball', 'Boxing', 'Wrestling', 'Swimming', 'Surfing', 'Skiing',
      'Snowboarding', 'Skateboarding', 'Cycling', 'Running', 'Gymnastics',
      'Bowling', 'Karate', 'Badminton', 'Table Tennis', 'Climbing', 'Diving',
      'Dodgeball', 'Pickleball', 'Darts', 'Pool', 'Ice Skating', 'Track',
    ],
  },
  {
    name: 'Countries',
    emoji: '🌍',
    primary: '#1976D2',
    secondary: '#0D47A1',
    words: [
      'United States', 'Canada', 'Mexico', 'Brazil', 'United Kingdom', 'France',
      'Germany', 'Spain', 'Italy', 'Portugal', 'Netherlands', 'Switzerland',
      'Sweden', 'Norway', 'Ireland', 'Greece', 'Turkey', 'Russia', 'Egypt',
      'Nigeria', 'South Africa', 'India', 'China', 'Japan', 'South Korea',
      'Thailand', 'Vietnam', 'Australia', 'New Zealand', 'Argentina',
    ],
  },
  {
    name: 'Superheroes',
    emoji: '🦸',
    primary: '#C62828',
    secondary: '#8E0000',
    words: [
      'Superman', 'Batman', 'Spider-Man', 'Iron Man', 'Captain America', 'Thor',
      'Hulk', 'Black Widow', 'Wonder Woman', 'The Flash', 'Aquaman', 'Wolverine',
      'Deadpool', 'Black Panther', 'Doctor Strange', 'Captain Marvel', 'Ant-Man',
      'Hawkeye', 'Green Arrow', 'Robin', 'Catwoman', 'Venom', 'Joker', 'Thanos',
      'Loki', 'Groot', 'Star-Lord', 'Storm', 'Magneto', 'The Punisher',
    ],
  },
  {
    name: 'Disney',
    emoji: '🏰',
    primary: '#0277BD',
    secondary: '#01579B',
    words: [
      'Mickey Mouse', 'Minnie Mouse', 'Donald Duck', 'Goofy', 'Cinderella',
      'Snow White', 'Ariel', 'Belle', 'Jasmine', 'Aladdin', 'Mulan', 'Elsa',
      'Anna', 'Olaf', 'Moana', 'Simba', 'Mufasa', 'Scar', 'Peter Pan',
      'Winnie the Pooh', 'Tigger', 'Dumbo', 'Bambi', 'Pinocchio', 'Stitch',
      'Buzz Lightyear', 'Woody', 'Nemo', 'Dory', 'Baymax',
    ],
  },
  {
    name: 'Vehicles',
    emoji: '🚗',
    primary: '#455A64',
    secondary: '#263238',
    words: [
      'Car', 'Truck', 'Motorcycle', 'Bicycle', 'Scooter', 'Bus', 'Train',
      'Airplane', 'Helicopter', 'Boat', 'Ship', 'Submarine', 'Canoe', 'Kayak',
      'Ambulance', 'Fire Truck', 'Police Car', 'Taxi', 'Van', 'Tractor',
      'Bulldozer', 'Tank', 'Golf Cart', 'Hot Air Balloon', 'Jet Ski',
      'Sailboat', 'Ferry', 'Limo', 'Pickup Truck', 'Rocket',
    ],
  },
  {
    name: 'Colleges',
    emoji: '🎓',
    primary: '#283593',
    secondary: '#1A237E',
    words: [
      'Harvard', 'Stanford', 'MIT', 'Yale', 'Princeton', 'Columbia', 'Cornell',
      'Brown', 'Dartmouth', 'UPenn', 'Duke', 'Northwestern', 'Johns Hopkins',
      'UC Berkeley', 'UCLA', 'USC', 'NYU', 'Georgetown', 'Notre Dame',
      'Vanderbilt', 'Carnegie Mellon', 'Michigan', 'UT Austin', 'Georgia Tech',
      'Ohio State', 'Penn State', 'Florida', 'Texas A&M', 'UNC', 'Boston University',
      'Oxford', 'Cambridge', 'Caltech',
    ],
  },
  {
    name: 'Japanese Foods',
    emoji: '🍣',
    primary: '#C62828',
    secondary: '#7F0000',
    words: [
      'Sushi', 'Sashimi', 'Ramen', 'Udon', 'Soba', 'Tempura', 'Miso Soup',
      'Onigiri', 'Tonkatsu', 'Gyoza', 'Teriyaki', 'Yakitori', 'Takoyaki',
      'Okonomiyaki', 'Mochi', 'Matcha', 'Edamame', 'Katsu Curry', 'Unagi',
      'Nigiri', 'Maki', 'Wagyu', 'Tamagoyaki', 'Natto', 'Dango', 'Taiyaki',
      'Karaage', 'Shabu-shabu', 'Sukiyaki', 'Bento', 'Donburi', 'Wasabi',
    ],
  },
];
