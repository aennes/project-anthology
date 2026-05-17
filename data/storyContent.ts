import { StoryContent } from '../types';

// Story content data - lazy loaded when story is opened
// Using direct image paths that match actual filenames in /images directory
export const storyContentMap: Record<string, StoryContent[]> = {
  'senna-monaco': [
    { type: 'paragraph', text: 'Monaco is not a race track; it is a cage. To drive fast here is to dance with a knife. In 1988, Ayrton Senna did not just drive; he entered a state of consciousness that few athletes ever reach. The car was an extension of his nervous system—but the car was an MP4/4, the product of a factory war McLaren and Honda were winning before either driver turned a wheel.' },
    { type: 'quote', text: 'I was no longer driving the car consciously. I was driving it by a kind of instinct, only I was in a different dimension.', author: 'Ayrton Senna' },
    { type: 'paragraph', text: 'He was two seconds faster than his teammate, Alain Prost—the Professor who read the same telemetry and refused to pay the price Senna demanded: tyres burned, margins spent, the limit held like a blade to the throat. In Formula 1, two seconds is not divinity; it is a psychological line drawn in the same cockpit.' },
    { type: 'image', src: '/Ayrton_Senna_1988_Canada.jpg', caption: 'MP4/4, Senna 1988.', layout: 'full' },
    { type: 'heading', text: 'The Crash' },
    { type: 'paragraph', text: 'And then, silence. At Portier, just before the tunnel, the concentration broke. The McLaren hit the barrier. Senna did not return to the pits. He walked straight to his apartment in Monaco and disappeared for hours. Perfection is fragile.' }
  ],
  'hunt-lauda': [
    { type: 'heading', text: 'Blueprints and Cigarettes' },
    { type: 'paragraph', text: 'Lauda calculated risk with a pencil; Hunt calculated pleasure with a cigarette. In 1976, the paddock felt like a courtroom. Ferrari\'s tribal court had already exiled Lauda once; McLaren\'s garage ran on cold mathematics. The cars were loud, but the verdicts were louder.' },
    { type: 'image', src: '/James_Hunt_-_Dutch_GP_1976.jpg', caption: 'Hunt in the rain, Zandvoort.', layout: 'landscape' },
    { type: 'paragraph', text: 'On Sunday mornings, Hunt wore chaos like a suit. Lauda wore discipline. Their laps were the same sentence written in two handwritings.' },
    { type: 'heading', text: 'The Ring' },
    { type: 'paragraph', text: 'At the Nürburgring, the track bit back. Steel met fire. Lauda\'s return six weeks later was not heroic in the Hollywood sense—it was a negotiation with pain, a handshake with mortality.' },
    { type: 'image', src: '/Niki_Lauda_-_Ferrari_312T2_heads_towards_the_swimming_pool_complex_at_the_1977_Monaco_GP.jpg', caption: 'Lauda Ferrari 312T2.', layout: 'portrait' },
    { type: 'heading', text: 'Championship as Philosophy' },
    { type: 'paragraph', text: 'The title did not crown the faster man; it crowned the framework. Hunt won the points. Lauda won the argument that bravery is not stupidity. The season wrote itself into F1\'s bones.' }
  ],
  'massa-2008': [
    { type: 'heading', text: 'Interlagos Weather Front' },
    { type: 'paragraph', text: 'São Paulo hung heavy with rain. The grandstands shook when the engines fired—wet air carrying petrol and electricity. Ferrari red glowed against the slate sky. Men in ponchos banged the hoardings. Mothers covered children\'s ears. The circuit was a lung breathing water.' },
    { type: 'image', src: '/Massa_Brazil_2008.jpg', caption: 'Interlagos grid in the rain.', layout: 'landscape' },
    { type: 'paragraph', text: 'Felipe Massa launched clean. Visibility was a rumor, grip a superstition. Through the Senna S, he felt the car bite and release—a Ferrari built in Maranello, fuelled and tyred by decisions made on the pit wall as much as in the cockpit. Each lap cut a groove into the storm.' },
    { type: 'heading', text: 'The Switch' },
    { type: 'paragraph', text: 'On worn slicks, Timo Glock became a question mark—a Toyota on the wrong rubber, playing the role of accident in someone else\'s formation. Hamilton, visor speckled with rain, was not chasing a driver; he was chasing a point tally McLaren had engineered all season. The penultimate corners turned into a courtroom.' },
    { type: 'image', src: '/Raikkonen_Brazil_2008.jpg', caption: 'Ferrari cutting through spray.', layout: 'portrait' },
    { type: 'quote', text: 'Is that Glock? Is that Glock going slowly?', author: 'Martin Brundle' },
    { type: 'paragraph', text: 'Massa crossed the line a champion. Thirty-nine seconds later, Hamilton slipped past Glock at the last turn. The garage stopped breathing. The noise collapsed into a single syllable of disbelief.' },
    { type: 'heading', text: 'Dignity' },
    { type: 'paragraph', text: 'On the podium, rain streaked his face like film grain. He beat his chest once, not in anger but in affirmation. The crowd did not chant points; they chanted a name. History measured him not by the trophy but by the manner in which he carried defeat.' },
    { type: 'image', src: '/Massa_Brazil_2008_Podium.jpg', caption: 'Massa on the podium, rain and light.', layout: 'full' }
  ],
  'schumacher-ferrari': [
    { type: 'heading', text: 'Maranello Bells' },
    { type: 'paragraph', text: 'For twenty-one years, the church at Maranello waited. The myth says one man rebuilt Ferrari; the ledger says Jean Todt, Ross Brawn, and a factory finally run like a clock—not a court. Schumacher was the needle; they were the mechanism. Pit stops became liturgy. Monday debriefs, penance.' },
    { type: 'image', src: '/Scuderia_Ferrari_F2004.jpg', caption: 'Ferrari F2004 silhouette.', layout: 'landscape' },
    { type: 'paragraph', text: 'Even his legendary feel for setup rode on Rubens Barrichello\'s laps and feedback—the number two doing the arithmetic the star would not admit. Mechanics trained like athletes. Engineers slept with spreadsheets. The F2004 was less a chariot than a ritual performed at 18,000 rpm.' },
    { type: 'heading', text: 'Dynasty' },
    { type: 'paragraph', text: 'From 2000 to 2004, the sport bent around Maranello\'s process, not a lone will. The title runs were not inevitable; they were constructed—lap by lap, checklists stacked like bricks, tribal pressure finally channelled into engineering.' },
    { type: 'image', src: '/Michael_Schumacher_Ferrari_2004.jpg', caption: 'Schumacher era, red dominance.', layout: 'portrait' },
    { type: 'quote', text: 'I\'ve always believed that you should never, ever give up and you should always keep fighting even when there\'s only the slightest chance.', author: 'Michael Schumacher' },
    { type: 'image', src: '/Italian_F1_-_Monza_-_Ank_Kumar_05.jpg', caption: 'The Tifosi at Monza.', layout: 'full' }
  ],
  'hakkinen-schumacher': [
    { type: 'heading', text: 'Knife Edge' },
    { type: 'paragraph', text: 'Spa is a geography lesson taught with velocity. Two factories had built two philosophies in carbon: McLaren\'s knife against Ferrari\'s hammer. Häkkinen read Schumacher\'s lines like scripture, waiting for the parishioner to blink.' },
    { type: 'image', src: '/Mika_Häkkinen_1.jpg', caption: 'Häkkinen, focus through Eau Rouge.', layout: 'landscape' },
    { type: 'paragraph', text: 'Approaching Zonta, the universe narrowed to three cars and one choice. The tyres drew calligraphy at 300 km/h. Left for Schumacher. Right for Häkkinen.' },
    { type: 'heading', text: 'The Split' },
    { type: 'paragraph', text: 'They passed on either side of a man trying to stay alive. It was not aggression; it was clarity. The move remains a lecture on decision under pressure.' },
    { type: 'image', src: '/Michael_Schumacher,_Ferrari_F2001_(8968595731)_(cropped).jpg', caption: 'Schumacher, the constant adversary.', layout: 'portrait' }
  ],
  'hamilton-silverstone': [
    { type: 'paragraph', text: 'The collision heard around the world. It wasn\'t just an accident; it was two championship machines meeting where the track narrows—Mercedes\' floor advantage against Red Bull\'s high-downforce knife, neither driver willing to yield the inside line that Sunday.' },
    { type: 'image', src: '/Lewis_Hamilton_on_his_victory_lap_(14634946913).jpg', caption: 'Hamilton\'s victory lap, Silverstone 2021.', layout: 'full' },
    { type: 'paragraph', text: 'Think of it like a basketball pick-and-roll gone wrong: two athletes executing the same play, each convinced the other broke the unwritten rule. The stewards would argue for days; the factories would file briefs in air.' },
    { type: 'quote', text: 'This is not tennis. This is life and death.', author: 'Toto Wolff' }
  ],
  'button-canada': [
    { type: 'heading', text: 'Weather System' },
    { type: 'paragraph', text: 'Montreal became a lake. Radios hissed. On the pit wall, McLaren\'s strategists played jazz—tyre compounds like substitutions, Safety Car phases like time-outs. Button fell to last, and then began the long arithmetic the car and the crew had to solve together.' },
    { type: 'image', src: '/2011_Canadian_GP_-_Winner.jpg', caption: 'Parc Jean-Drapeau under rain.', layout: 'landscape' },
    { type: 'heading', text: 'The Hunt' },
    { type: 'paragraph', text: 'He absorbed penalties, touched cars, and kept the rhythm. On the final lap, Vettel hesitated. Button did not. The river delivered him to the flag first.' },
    { type: 'image', src: '/640px-2011_Canadian_GP_-_Hamilton-Webber.jpg', caption: 'Button, soaked and relentless.', layout: 'portrait' }
  ],
  'fangio-nurburgring': [
    { type: 'heading', text: 'The Pit Gamble' },
    { type: 'paragraph', text: 'The Nürburgring was a cathedral of trees and fear. When Maserati\'s pit stop went wrong—fuel and tyres lost to human error—Fangio returned to the track with the sort of silence only great men carry. The car spoke through vibration rather than sound; the comeback was geometry, not prayer.' },
    { type: 'image', src: '/Maserati_250F_at_Goodwood_2010.jpg', caption: 'Maserati 250F lines and muscle.', layout: 'landscape' },
    { type: 'paragraph', text: 'The 250F danced on the edge of the tires. He carved the forest with nine straight lap records, not a fury but a precision—each apex a signature, each exit a threat.' },
    { type: 'heading', text: 'The Chase' },
    { type: 'paragraph', text: 'Hawthorn and Collins were boys sprinting ahead of a storm. Fangio was the weather. In the Karussell, he laid the car on its side, chalk dust and rubber stinging his throat. The crowd felt the air pressure change.' },
    { type: 'image', src: '/Maserati_250F_(Juan_Fangio).jpg', caption: 'Fangio and the 250F.', layout: 'portrait' },
    { type: 'quote', text: 'I have never driven that fast before in my life and I don\'t think I will ever be able to do it again.', author: 'Juan Manuel Fangio' },
    { type: 'heading', text: 'The Echo' },
    { type: 'paragraph', text: 'When he made the pass, the forest did not explode; it exhaled. Decades later, drivers still speak of the lap as if it were a myth told by campfire. It was not bravado. It was geometry with blood in it.' }
  ],
  'dijon-1979': [
    { type: 'heading', text: 'Home Victory, Battle Behind' },
    { type: 'paragraph', text: 'Jabouille\'s Renault won for France and for the turbo—a factory breakthrough the old guard resented. Behind him, Villeneuve drove like a street fighter; Arnoux like a surgeon who had decided to operate without anaesthetic. Two Ferraris, one manifesto about courage and control.' },
    { type: 'image', src: '/Ferrari_312T4_-_Jody_Scheckter_at_the_1979_Belgian_Grand_Prix,_Zolder_(51632958993).jpg', caption: 'Villeneuve\'s 312T4.', layout: 'landscape' },
    { type: 'paragraph', text: 'They touched wheels, slid off, rejoined, and refused to concede space that did not exist. It was violence without malice; an argument conducted at 200 km/h—psychology as much as racing line.' },
    { type: 'image', src: '/Renault_RS10,_GIMS_2019,_Le_Grand-Saconnex_(GIMS1205).jpg', caption: 'Arnoux in the RS10.', layout: 'portrait' },
    { type: 'heading', text: 'Respect' },
    { type: 'paragraph', text: 'Villeneuve finished second by two tenths. Arnoux smiled. The crowd understood: sometimes the greatest victory is shared.' }
  ],
  'imola-1994': [
    { type: 'heading', text: 'Omen' },
    { type: 'paragraph', text: 'Barrichello flew. Ratzenberger fell. The paddock met in whispers about safety that was decades late—politics and denial dressed as tradition. Senna carried the weight like a visible shadow, but Imola was also a failure of governance, not only of courage.' },
    { type: 'image', src: '/AyrtonSennaMemorialAtImola.jpg', caption: 'Senna memorial, Parco delle Acque Minerali.', layout: 'portrait' },
    { type: 'heading', text: 'Tamburello' },
    { type: 'paragraph', text: 'At lap six, the world changed at a concrete wall. The broadcast did not need words. The sport would never be the same.' },
    { type: 'image', src: '/Autodromo_aerea_poster.jpg', caption: 'Imola, old flow, new scars.', layout: 'landscape' },
    { type: 'paragraph', text: 'From that day, safety was not an option; it was a promise. Two names—Roland and Ayrton—are the reason modern drivers get to grow old.' }
  ],
  'brawn-2009': [
    { type: 'heading', text: 'Buyout and Belief' },
    { type: 'paragraph', text: 'Honda left. Ross Brawn stayed—the same mind that had clocked Ferrari\'s mechanics into a dynasty. A Mercedes engine found a home, and a double diffuser found a loophole in the rulebook the way a lawyer finds a comma. The paddock laughed until Australia.' },
    { type: 'image', src: '/640px-Jenson_Button_(Brawn_BGP_001)_on_Sunday_at_2009_Abu_Dhabi_Grand_Prix.jpg', caption: 'BGP001 lines, white and neon.', layout: 'portrait' },
    { type: 'heading', text: 'Six of Seven' },
    { type: 'paragraph', text: 'Button won six of the first seven. Barrichello held the centre. By Brazil, a team that should not have existed owned the year.' },
    { type: 'image', src: '/Barrichello_2009_British_GP_2.jpg', caption: 'Button\'s 2009 motif.', layout: 'landscape' }
  ],
  'schumacher-1994-spain': [
    { type: 'heading', text: 'The Jam' },
    { type: 'paragraph', text: 'Barcelona, lap 20. The gearbox locked in fifth—a mechanical sentence the Benetton engineers could not commute. Physics said stop. Schumacher said continue. The car became a single-speed machine, a metronome of impossibility the factory would study for years.' },
    { type: 'image', src: '/Schumacher_Benetton_B194.jpg', caption: 'Schumacher Benetton B194 Spain 1994.', layout: 'full' },
    { type: 'paragraph', text: 'He could not downshift. He could not upshift. The car was a prisoner of its own mechanics. Yet he drove it like a weapon, each corner a negotiation with momentum.' },
    { type: 'image', src: '/Schumacher_Spain_1994_cockpit.jpg', caption: 'Steering wheel, Spain 1994.', layout: 'portrait', isBackground: true },
    { type: 'heading', text: 'The Physics' },
    { type: 'paragraph', text: 'On the straights, he coasted. In the corners, he carried speed like a secret. The engine screamed in one note, a monotone of defiance. Second place was not a result; it was a rewrite of the rulebook.' },
    { type: 'image', src: '/Benetton_B194_exhaust.jpg', caption: 'Benetton B194 exhaust flames.', layout: 'landscape' },
    { type: 'quote', text: 'I had to drive the whole race in fifth gear. It was like driving a truck.', author: 'Michael Schumacher' }
  ],
  'collins-fangio-1956': [
    { type: 'heading', text: 'Monza, Final Round' },
    { type: 'paragraph', text: 'Peter Collins was leading the championship. Fangio\'s car had failed. In the pits, Collins made a decision that would cost him everything and define him forever.' },
    { type: 'image', src: '/Collins_Fangio_Monza_1956.jpg', caption: 'Collins and Fangio, Monza 1956.', layout: 'full' },
    { type: 'paragraph', text: 'He stepped out. He handed over the wheel. He gave away his world title to a man who had already won four. Ferrari\'s court would call it honor; the points table would call it arithmetic. The gesture was tribal loyalty written in steel and petrol.' },
    { type: 'image', src: '/Ferrari_D50_Monza_1956.jpg', caption: 'Ferrari D50 Monza 1956 track action.', layout: 'landscape' },
    { type: 'heading', text: 'The Gift' },
    { type: 'paragraph', text: 'Fangio won his fifth title. Collins finished second. In the paddock, men shook hands. The sport understood that some victories are shared, some titles are earned through sacrifice.' },
    { type: 'image', src: '/Collins_giving_car_Fangio_1956.jpg', caption: 'Collins giving car to Fangio, 1956.', layout: 'portrait' },
    { type: 'quote', text: 'I would have done the same for him.', author: 'Peter Collins' }
  ],
  'monaco-1982': [
    { type: 'heading', text: 'The Final Lap' },
    { type: 'paragraph', text: 'Monaco, 1982. Rain mixed with oil. Engines failing like dominoes. The lead changed hands five times on the last lap. The track became a lottery where skill met chaos—a Sunday that would feel impossible in today\'s sterile, simulation-perfect paddock.' },
    { type: 'image', src: '/Monaco_GP_1982_Patrese.jpg', caption: 'Monaco GP 1982 final lap chaos.', layout: 'full' },
    { type: 'paragraph', text: 'Pironi stalled. De Cesaris ran out of fuel. Daly crashed. Prost\'s engine died. The streets of Monte Carlo wrote a script that no one could have imagined.' },
    { type: 'image', src: '/Pironi_Ferrari_Monaco_1982.jpg', caption: 'Didier Pironi Ferrari Monaco 1982 stalled.', layout: 'landscape' },
    { type: 'heading', text: 'The Winner' },
    { type: 'paragraph', text: 'Riccardo Patrese crossed the line first. He had been last at one point. He had spun. He had restarted. In Monaco, the track always wins, but sometimes it chooses an unlikely champion.' },
    { type: 'image', src: '/Patrese_Brabham_Monaco_1982.jpg', caption: 'Riccardo Patrese Brabham Monaco 1982 win.', layout: 'portrait' }
  ],
  'jerez-1997': [
    { type: 'heading', text: 'The Mathematical Impossibility' },
    { type: 'paragraph', text: 'Three drivers. One exact time: 1:21.072. To the thousandth of a second, Villeneuve, Schumacher, and Frentzen were identical. The universe had written a riddle.' },
    { type: 'image', src: '/Villeneuve_Schumacher_Jerez_1997.jpg', caption: 'Villeneuve Schumacher Frentzen 1:21.072 timing.', layout: 'full', isBackground: true },
    { type: 'paragraph', text: 'The timing screens froze. Engineers checked their calculations. The probability was astronomical. Yet there it was—three men, one moment, perfectly synchronized.' },
    { type: 'heading', text: 'The Collision' },
    { type: 'paragraph', text: 'In the race, Schumacher turned in—a championship calculation when overtaking on pace was no longer enough. Villeneuve held his line. Metal met metal at the apex. Ferrari\'s title bid became politics at 200 km/h.' },
    { type: 'image', src: '/Schumacher_Villeneuve_Jerez_crash.jpg', caption: 'Schumacher Villeneuve Jerez 1997 crash contact.', layout: 'landscape' },
    { type: 'paragraph', text: 'Schumacher retired. Villeneuve continued. The Williams—Newey\'s air, Renault\'s grunt—crossed the line, and the title was decided. The mathematical miracle had set the stage for the most controversial moment in modern F1.' },
    { type: 'image', src: '/Villeneuve_Williams_Jerez_1997.jpg', caption: 'Jacques Villeneuve Williams 1997 Jerez celebration.', layout: 'portrait' }
  ],
  'senna-donington-1993': [
    { type: 'heading', text: 'The Deluge' },
    { type: 'paragraph', text: 'Donington Park, 1993. The rain fell like judgment. Williams had brought active suspension and a budget that made McLaren look mortal on paper—yet in the wet, Senna drove as if intimidation were a setup parameter. The opening lap became a gallery of impossible moves.' },
    { type: 'image', src: '/Senna_Donington_1993_Rain.jpg', caption: 'Ayrton Senna Donington 1993 rain opening lap.', layout: 'full' },
    { type: 'paragraph', text: 'He passed four cars before the first corner—Prost would have waited for lap twenty; Senna took the gap now or made one. He treated the water as his canvas, each spray a brushstroke. The MP4/8 danced where active suspension could not think fast enough.' },
    { type: 'image', src: '/Senna_MP4_8_Donington_spray.jpg', caption: 'Senna McLaren MP4/8 Donington water spray.', layout: 'landscape' },
    { type: 'heading', text: 'The Masterpiece' },
    { type: 'paragraph', text: 'By lap three, he was leading. The rest of the field was still finding their rhythm. Senna had already written the story—but the story was also a reminder: when the rules allow one team a technological cathedral, only certain drivers can storm it in the rain.' },
    { type: 'image', src: '/Senna_Donington_1993_trophy.jpg', caption: 'Ayrton Senna Donington 1993 Sonic trophy.', layout: 'portrait' },
    { type: 'quote', text: 'That first lap was the best lap of my life.', author: 'Ayrton Senna' }
  ],
  'jaguar-monaco-diamond': [
    { type: 'heading', text: 'The Publicity Stunt' },
    { type: 'paragraph', text: 'Ocean\'s Twelve was in the cinemas. Jaguar Racing had a script of their own. On the nose of the R5—Christian Klien\'s car—sat a Steinmetz diamond. Three hundred thousand dollars. Not for speed. For spectacle.' },
    { type: 'paragraph', text: 'The stunt was pure Hollywood: a jewel on the tip of a Formula 1 car, glinting under the Monaco sun—marketing in an era when the sport still tolerated circus beside science. The world would watch. The diamond would shine. Until the track had other ideas.' },
    { type: 'image', src: '/Jaguar_Monaco_2004_diamond.jpg', caption: 'Jaguar R5 nose with Steinmetz diamond, Monaco 2004.', layout: 'full' },
    { type: 'heading', text: 'The Impact' },
    { type: 'paragraph', text: 'Lap one. Loews—the hairpin that has broken champions. Klien turned in. The car bit back. The nose shattered. Carbon fibre and ambition scattered across the runoff. And somewhere in that debris—or in the air, or in the sea—was a stone worth a house.' },
    { type: 'image', src: '/Jaguar_Monaco_2004_Klien_crash.jpg', caption: 'Christian Klien, Jaguar R5, Loews hairpin crash, Monaco 2004.', layout: 'landscape' },
    { type: 'paragraph', text: 'The broadcast did not need words. The diamond had left the script. The Mediterranean lay metres away. The streets of Monte Carlo had swallowed greater treasures. This one simply vanished.' },
    { type: 'heading', text: 'The Mystery' },
    { type: 'paragraph', text: 'When the red flags fell, the mechanics came. They sifted through the wreck. They searched the runoff, the barriers, the gaps in the Armco. The diamond was gone.' },
    { type: 'image', src: '/Jaguar_Monaco_2004_diamond_lost.jpg', caption: 'Enigma: the lost Steinmetz diamond of Monaco.', layout: 'portrait' },
    { type: 'paragraph', text: 'To this day, no one knows. The sea? A drain? A fan\'s pocket? A gutter in the principality? The story became a legend—a $300,000 mistake that slipped through the fingers of history. In an older F1, incompetence and spectacle shared the grid; today\'s cars are too perfect for a teacup in the pits, but still perfect for a diamond on the nose. Jaguar left the sport. The diamond never came back.' }
  ],
};
