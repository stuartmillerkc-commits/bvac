/**
 * Common English given-name nicknames, for matching typed friend requests
 * ("Jake Miller" -> Jacob Miller). Each group lists a formal name first, then
 * the short forms families type. A short form may belong to several groups
 * ("Chris" -> Christopher or Christian); the matcher then reports every
 * candidate as ambiguous rather than guessing.
 *
 * Starts from `NICKNAMES` in @bvac/seed (a test checks every pair is covered).
 */
const GROUPS: string[][] = [
  ['William', 'Will', 'Willie', 'Bill', 'Billy'],
  ['Benjamin', 'Ben', 'Benji', 'Benny'],
  ['Theodore', 'Teddy', 'Ted', 'Theo'],
  ['Alexander', 'Alex', 'Xander', 'Al'],
  ['Alexandra', 'Alex', 'Lexi', 'Ali'],
  ['Daniel', 'Danny', 'Dan'],
  ['Michael', 'Mikey', 'Mike', 'Mick'],
  ['Samuel', 'Sam', 'Sammy'],
  ['Samantha', 'Sam', 'Sammy'],
  ['Jacob', 'Jake'],
  ['Joseph', 'Joey', 'Joe'],
  ['Matthew', 'Matt', 'Matty'],
  ['Nathan', 'Nate'],
  ['Nathaniel', 'Nate', 'Nathan'],
  ['Christopher', 'Chris', 'Topher'],
  ['Christian', 'Chris'],
  ['Jonathan', 'Jon', 'Jonny', 'Johnny'],
  ['John', 'Johnny', 'Jack'],
  ['Robert', 'Bobby', 'Bob', 'Rob', 'Robbie'],
  ['Elizabeth', 'Libby', 'Liz', 'Lizzie', 'Beth', 'Eliza', 'Betsy'],
  ['Abigail', 'Abby', 'Abbie'],
  ['Penelope', 'Penny', 'Nell'],
  ['Victoria', 'Tori', 'Vicky'],
  ['Josephine', 'Josie', 'Jo'],
  ['Natalie', 'Nat', 'Nattie'],
  ['Natalia', 'Nat', 'Talia'],
  ['Madelyn', 'Maddie', 'Maddy'],
  ['Madison', 'Maddie', 'Maddy'],
  ['Isabella', 'Bella', 'Izzy', 'Isa'],
  ['Eleanor', 'Ellie', 'Nora', 'Elle'],
  ['Gabriel', 'Gabe'],
  ['Anthony', 'Tony'],
  ['Andrew', 'Andy', 'Drew'],
  ['Joshua', 'Josh'],
  ['Zachary', 'Zach', 'Zack'],
  ['Nicholas', 'Nick', 'Nicky'],
  ['Thomas', 'Tom', 'Tommy'],
  ['Charles', 'Charlie', 'Chuck'],
  ['Charlotte', 'Charlie', 'Lottie'],
  ['Timothy', 'Tim', 'Timmy'],
  ['Jameson', 'Jamie'],
  ['James', 'Jim', 'Jimmy', 'Jamie'],
  ['Maverick', 'Mav'],
  ['Sebastian', 'Seb', 'Bash'],
  ['Ezekiel', 'Zeke'],
  ['Josiah', 'Joe', 'Josi'],
  ['Elijah', 'Eli'],
  ['Elias', 'Eli'],
  ['Katherine', 'Kate', 'Katie', 'Kat'],
  ['Margaret', 'Maggie', 'Meg', 'Peggy'],
  ['Olivia', 'Liv', 'Livvy'],
  ['Sophia', 'Sophie'],
  ['Amelia', 'Millie', 'Amy'],
  ['Emily', 'Em', 'Emmy'],
  ['Evelyn', 'Evie'],
  ['Valentina', 'Val', 'Tina'],
  ['Gianna', 'Gigi'],
  ['Kennedy', 'Kenny'],
  ['Savannah', 'Savvy'],
  ['Athena', 'Thena'],
  ['Lillian', 'Lily', 'Lil'],
  ['Caroline', 'Carrie', 'Callie'],
];

/** Lowercase name -> every lowercase name it may stand for (including itself). */
const VARIANTS: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    const set = map.get(a) ?? new Set([a]);
    set.add(b);
    map.set(a, set);
  };
  for (const group of GROUPS) {
    const [formal, ...shorts] = group.map((n) => n.toLowerCase());
    for (const s of shorts) {
      add(formal!, s);
      add(s, formal!);
    }
  }
  return map;
})();

/** Names a typed first name could refer to, lowercase, including itself. */
export function nameVariants(firstNameKey: string): ReadonlySet<string> {
  return VARIANTS.get(firstNameKey) ?? new Set([firstNameKey]);
}

/** The groups, for tests and the docs. */
export const NICKNAME_GROUPS: readonly (readonly string[])[] = GROUPS;
