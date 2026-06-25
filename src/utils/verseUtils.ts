import { AppState, TranslationPair, TRANSLATION_PAIRS, Verse, Translation, PathDay } from "../types";
import { BOOK_TO_USFM, CANONICAL_USFM_NAMES } from "../services/apiBible";

/**
 * Gets the current translation pair based on the app state.
 */
export function getCurrentTranslationPair(state: AppState): TranslationPair {
  return state.selectedTranslations;
}

/**
 * Validates if a verse has the required text for a specific translation.
 */
export function validateVerseTranslation(verse: Verse | null, lang: "es" | "en", translation: Translation): { isValid: boolean; error?: string } {
  if (!verse || !verse.text || !verse.text[lang]) {
    return { 
      isValid: false, 
      error: lang === "es" 
        ? "Texto no disponible." 
        : "Text unavailable." 
    };
  }
  
  const text = verse.text[lang][translation];
  if (
    !text || 
    text.trim() === "" || 
    text.toLowerCase().includes("coming soon") || 
    text.toLowerCase().includes("proximamente") || 
    text.toLowerCase().includes("próximamente")
  ) {
    return { 
      isValid: false, 
      error: lang === "es" 
        ? `Este versículo no está disponible en la traducción ${translation}.` 
        : `This verse is unavailable in the selected translation (${translation}).` 
    };
  }
  return { isValid: true };
}

/**
 * Gets the verse text for a specific language and translation, with strict validation.
 * Returns null if the translation is missing.
 */
export function getSafeVerseText(verse: Verse, lang: "es" | "en", translation: Translation): string | null {
  const validation = validateVerseTranslation(verse, lang, translation);
  if (!validation.isValid) {
    return null;
  }
  return verse.text[lang][translation];
}

/**
 * Rebuilds a verse object or ensures it's fresh for the current translations.
 * (In this mock setup, it mostly serves as a validation layer)
 */
export function getValidatedVerse(verse: Verse | null, state: AppState): { 
  esText: string | null; 
  enText: string | null; 
  esError?: string; 
  enError?: string;
  activePair: TranslationPair;
} {
  const baseActivePair = getCurrentTranslationPair(state);
  
  if (!verse) {
    return {
      esText: null,
      enText: null,
      esError: state.primaryLanguage === 'es' ? 'Versículo no disponible' : 'Verse unavailable',
      enError: state.primaryLanguage === 'en' ? 'Verse unavailable' : 'Versículo no disponible',
      activePair: baseActivePair
    };
  }

  // Handle translation override for custom verses (Part 8)
  const activePair = { ...baseActivePair };
  if (verse.source === "custom" && verse.preferredTranslation) {
    const pref = verse.preferredTranslation;
    // Check if preferred translation is Spanish or English set
    const isEsTrans = ["RVR1960", "NVI", "NBLA"].includes(pref);
    if (isEsTrans) {
      activePair.es = pref;
    } else {
      activePair.en = pref;
    }
  }

  const esResult = (state.memorizeMode === 'es' || state.memorizeMode === 'both') 
    ? validateVerseTranslation(verse, "es", activePair.es)
    : { isValid: false };
    
  const enResult = (state.memorizeMode === 'en' || state.memorizeMode === 'both')
    ? validateVerseTranslation(verse, "en", activePair.en)
    : { isValid: false };
  
  return {
    esText: esResult.isValid ? verse.text.es[activePair.es] : null,
    enText: enResult.isValid ? verse.text.en[activePair.en] : null,
    esError: esResult.error,
    enError: enResult.error,
    activePair
  };
}

/**
 * Gets the localized book name based on the memorize mode.
 */
export function getLocalizedBookName(book: string, mode: "es" | "en" | "both"): string {
  if (!book) return "";
  
  const parts = book.split(' / ').map(p => p.trim());
  let usfm: string | null = null;
  
  for (const p of [...parts, book]) {
    const key = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Also try a punctuation-stripped key so abbreviations stored with a trailing
    // dot (e.g. "Phil." -> "phil", "1 Cor." -> "1 cor") still resolve. Letters,
    // digits in numbered books, and meaningful internal spaces are preserved.
    const cleanKey = key.replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
    const matchKey = (BOOK_TO_USFM && BOOK_TO_USFM[key])
      ? key
      : (BOOK_TO_USFM && BOOK_TO_USFM[cleanKey] ? cleanKey : null);
    if (matchKey) {
      usfm = BOOK_TO_USFM[matchKey];
      break;
    }
  }

  if (usfm && CANONICAL_USFM_NAMES && CANONICAL_USFM_NAMES[usfm]) {
    const canonical = CANONICAL_USFM_NAMES[usfm];
    let result = book;
    if (mode === 'es') result = canonical.es;
    else if (mode === 'en') result = canonical.en;
    else result = `${canonical.es} / ${canonical.en}`;
    
    // Singular Psalm/Salmo logic support
    const isSingular = parts.some(p => {
      const low = p.toLowerCase();
      return low === 'psalm' || low === 'salmo';
    });
    if (isSingular && usfm === 'PSA') {
      if (mode === 'es') result = "Salmo";
      else if (mode === 'en') result = "Psalm";
      else result = "Salmo / Psalm";
    }
    
    // Preserve uppercase casing if original was uppercase
    if (book === book.toUpperCase()) {
      result = result.toUpperCase();
    }
    return result;
  }

  const esBook = parts[0];
  const enBook = parts[1] || parts[0];
  let res = book;
  if (mode === 'es') res = esBook;
  else if (mode === 'en') res = enBook;
  
  if (book === book.toUpperCase()) {
    res = res.toUpperCase();
  }
  return res;
}

/**
 * Localizes only the book name in a Bible reference format, preserving chapter and verse.
 */
export function formatReferenceForLocale(reference: string, lang: 'es' | 'en'): string {
  if (!reference) return "";
  
  // Clean custom IDs or other references that don't match standard Bible references
  if (reference.startsWith('custom-v-') || reference.startsWith('ref-')) {
    return reference;
  }
  
  const regex = /(?:^|\s+|[:.,;]+)(\d+)\s*[:.,;\s]\s*([\d\-]+)\s*$/;
  const match = reference.trim().match(regex);
  if (!match) {
    return getLocalizedBookName(reference.trim(), lang);
  }
  
  const matchIndex = match.index || 0;
  let bookPart = reference.trim().slice(0, matchIndex).trim();
  bookPart = bookPart.replace(/[:.,;]+$/, "").trim();
  
  const chapterVersePart = reference.trim().slice(matchIndex).trim();
  
  const localizedBook = getLocalizedBookName(bookPart, lang);
  return `${localizedBook} ${chapterVersePart}`;
}

/**
 * Builds a user-facing reference from a canonical (or defensively normalizable)
 * book identity, its chapter and verse, and the ordered list of displayed
 * languages. The chapter and verse are appended exactly once; each language's
 * full localized book name is resolved via getLocalizedBookName. Language order
 * follows the supplied order (which callers derive from the displayed verse-body
 * order), duplicate languages are dropped without reordering, and two languages
 * that resolve to the same display name collapse to one.
 *
 * Examples:
 *   ['en']        -> "James 1:5"
 *   ['es']        -> "Santiago 1:5"
 *   ['es','en']   -> "Santiago / James 1:5"
 *   ['en','es']   -> "James / Santiago 1:5"
 */
export function formatLocalizedReference(
  book: string,
  chapter: number | string,
  verse: number | string,
  orderedLanguages: ('es' | 'en')[]
): string {
  // Drop duplicate languages while preserving the supplied order.
  const langs = orderedLanguages.filter((lang, i) => orderedLanguages.indexOf(lang) === i);

  const names: string[] = [];
  for (const lang of langs) {
    const name = getLocalizedBookName(book, lang);
    // Skip empties and identical display names so the same book never appears twice.
    if (name && !names.includes(name)) names.push(name);
  }

  // Safest canonical fallback if no language was supplied or none resolved.
  const bookPart = names.length > 0 ? names.join(' / ') : getLocalizedBookName(book, 'en');
  return `${bookPart} ${chapter}:${verse}`;
}

const DAY_TITLE_TRANSLATIONS: Record<string, string> = {
  // Jesus
  "The Word Became Flesh": "La Palabra se hizo carne",
  "Image of the Invisible God": "Imagen del Dios invisible",
  "Radiance of God's Glory": "Resplandor de la gloria de Dios",
  "God So Loved the World": "Tanto amó Dios al mundo",
  "He Humbled Himself": "Se humilló a sí mismo",
  "The Way, Truth and Life": "El Camino, la Verdad y la Vida",
  "Come to Me and Rest": "Vengan a mí y descansen",
  "Abundant Life in Christ": "Vida abundante en Cristo",
  "You Are the Messiah": "Tú eres el Mesías",
  "The Living One": "El Viviente",

  // Anxiety
  "Do Not Be Anxious": "No se inquieten",
  "Rest for the Weary": "Descanso para el cansado",
  "Search My Heart": "Examina mi corazón",
  "Cast Your Cares": "Echen sus ansiedades",
  "Consolations Cheer": "Tus consolaciones me alegran",
  "Spirit of Power": "Espíritu de poder",
  "Perfect Peace": "Paz perfecta",
  "Delivered from Fear": "Librado del temor",
  "A Cheerful Word": "Una buena palabra",
  "Do Not Let Your Heart Be Troubled": "No se turbe vuestro corazón",
  "He Sustains You": "Él te sostendrá",
  "Nothing Can Separate Us": "Nada nos puede separar",
  "New Every Morning": "Nuevas cada mañana",
  "My Help Comes from the Lord": "Mi socorro viene del Señor",
  "Peace of Christ": "Paz de Cristo",

  // Burnout
  "He Restores My Soul": "Él restaura mi alma",
  "Renewed Strength": "Fuerzas renovadas",
  "My Grace Is Sufficient": "Mi gracia es suficiente",
  "Be Still and Know": "Quédense quietos y sepan",
  "Come Away and Rest": "Vengan y descansen",
  "Keep Your Zeal": "Mantengan el fervor",
  "Enter God's Rest": "Entrar en el reposo de Dios",
  "Do Not Grow Weary": "No nos cansemos",
  "He Grants Sleep": "Él da el sueño",

  // Faith
  "Faith Is Confidence": "La fe es la garantía",
  "Without Faith": "Sin fe",
  "Faith Comes by Hearing": "La fe viene por el oír",
  "Walk by Faith": "Caminar por fe",
  "Crucified with Christ": "Crucificado con Cristo",
  "Help My Unbelief": "Ayuda a mi incredulidad",
  "Faith and Works": "La fe sin obras",

  // Fear of Future
  "Do Not Worry About Tomorrow": "No se preocupen por el mañana",
  "Do Not Fear": "No temas",
  "Trust the Lord": "Confía en el Señor",
  "When I Am Afraid": "Cuando tengo miedo",
  "If God Is For Us": "Si Dios está por nosotros",
  "Commit Your Way": "Encomienda tu camino",
  "Cast All Your Care": "Echen toda ansiedad",
  "Be Strong and Courageous": "Esfuérzate y sé valiente",
  "Fear No Evil": "No temeré mal alguno",
  "Never Will I Leave You": "Nunca te dejaré",
  "God Is Our Refuge": "Dios es nuestro refugio",
  "Who of You by Worrying": "¿Quién de ustedes por ansioso?",
  "I Will Say of the Lord": "Diré yo del Señor",
  "Peace I Leave With You": "La paz les dejo",

  // For Students
  "Work Heartily": "Trabajen de corazón",
  "Fear of the Lord Is Wisdom": "El temor del Señor es sabiduría",
  "Keep Your Way Pure": "Mantener puro el camino",
  "Present Yourself Approved": "Preséntate aprobado",
  "Walk with the Wise": "Caminar con sabios",
  "Strength in Christ": "Fortaleza en Cristo",
  "God Gives Knowledge": "Dios da conocimiento",
  "Commit Your Work": "Encomienda tus obras",
  "Seek Me and Find Me": "Búquenme y me encontrarán",
  "Continue in Christ": "Continúen en Cristo",
  "Light and Understanding": "Luz y entendimiento",

  // Grief
  "Close to the Broken-hearted": "Cercano a los quebrantados de corazón",
  "Blessed Are Those Who Mourn": "Bienaventurados los que lloran",
  "Comforted to Comfort": "Consolados para consolar",
  "He Heals the Broken-hearted": "Él sana a los quebrantados de corazón",
  "Resurrection and Life": "Resurrección y vida",
  "No More Tears": "No más lágrimas",
  "Walking through the Valley": "Caminar por el valle",
  "Future Glory": "Gloria futura",
  "Joy Comes in the Morning": "El gozo viene en la mañana",
  "Hope in Resurrection": "Esperanza en la resurrección",
  "He Bore Our Griefs": "Él llevó nuestros dolores",
  "You Delivered My Soul": "Libraste mi alma",
  "His Compassion Never Fails": "Su compasión nunca falla",

  // Hope
  "Overflow with Hope": "Abundar en esperanza",
  "My Hope Is in You": "Mi esperanza está en ti",
  "Living Hope": "Esperanza viva",
  "Anchor for the Soul": "Ancla del alma",
  "Great Is Your Faithfulness": "Grande es tu fidelidad",
  "Saved in Hope": "Salvos en esperanza",
  "Wait for the Lord": "Esperar en el Señor",
  "Hope Does Not Disappoint": "La esperanza no avergüenza",
  "Always Have Hope": "Tener siempre esperanza",
  "Hold Unswervingly": "Mantener firme la esperanza",
  "Endurance Inspired by Hope": "La perseverancia inspirada por la esperanza",
  "Christ in You": "Cristo en ustedes",
  "Hope in God": "Esperar en Dios",

  // Identity
  "Made in God's Image": "Creado a imagen de Dios",
  "Fearfully and Wonderfully Made": "Formidable y maravillosamente creado",
  "Children of God": "Hijos de Dios",
  "New Creation": "Nueva creación",
  "Christ Lives in Me": "Cristo vive en mí",
  "God's Handiwork": "Hechura de Dios",
  "Chosen People": "Pueblo escogido",
  "Heirs of God": "Herederos de Dios",
  "Hidden with Christ": "Escondido con Cristo",
  "Many Members, One Body": "Muchos miembros, un cuerpo",
  "All One in Christ": "Todos uno en Cristo",
  "Loved Children": "Hijos amados",
  "Citizens of Heaven": "Ciudadanos del cielo",
  "Temple of the Holy Spirit": "Templo del Espíritu Santo",
  "Crowned with Glory": "Coronado de gloria",

  // Loneliness
  "Turn to Me and Be Gracious": "Mírame y ten misericordia de mí",
  "He Sets the Lonely in Families": "Él hace habitar en familia a los desamparados",
  "I Will Never Leave You": "Nunca te dejaré",
  "The Lord Receives Me": "El Señor me acogerá",
  "Fear Not; I Am with You": "No temas; yo estoy contigo",
  "Not Orphans": "No los dejaré huérfanos",
  "The Lord Stood by Me": "El Señor estuvo a mi lado",

  // New Beginnings
  "A New Thing": "Algo nuevo",
  "New Mercies": "Nuevas misericordias",
  "New Heart and Spirit": "Corazón nuevo y espíritu nuevo",
  "Press On": "Proseguir a la meta",
  "Good News to the Afflicted": "Buenas nuevas a los afligidos",
  "Born Again": "Nacer de nuevo",
  "New Song": "Cántico nuevo",
  "Washing of Regeneration": "Lavamiento de la regeneración",
  "Making All Things New": "Hacer nuevas todas las cosas",

  // New Believer
  "Repent and Be Baptized": "Arrepentirse y ser bautizados",
  "Walk in Newness of Life": "Andar en vida nueva",
  "Walk in Him": "Andar en Él",
  "Desire Pure Milk": "Desear la leche espiritual pura",
  "Put on the New Self": "Vestirse del nuevo hombre",

  // Parenting
  "Train Up a Child": "Instruye al niño",
  "Bring Them Up in the Lord": "Criarlos en el Señor",
  "Do Not Exasperate": "No exasperar",
  "Teach Them Diligently": "Enseñar diligentemente",
  "Children Are Heritage": "Los hijos son herencia",
  "Listen to Your Parents": "Escuchar a tus padres",
  "From Childhood You Have Known": "Desde la niñez has sabido",

  // Peace
  "My Peace I Give You": "Mi paz les doy",
  "The Lord Give You Peace": "El Señor te dé paz",
  "Peace with God": "Paz para con Dios",
  "Peaceful Sleep": "Sueño pacífico",
  "Let Peace Rule": "Que la paz gobierne",
  "Make Every Effort for Peace": "Buscar la paz con empeño",
  "Great Peace": "Gran paz",
  "As Far As It Depends on You": "En cuanto dependa de ustedes",

  // Prayer
  "Our Father in Heaven": "Padre nuestro que estás en los cielos",
  "Present Your Requests": "Presentar sus peticiones",
  "Pray Without Ceasing": "Orar sin cesar",
  "Prayer of the Righteous": "La oración del justo",
  "Always Pray and Not Give Up": "Orar siempre y no desmayar",
  "Believe You Have Received": "Creer que ya han recibido",
  "Confidence in Prayer": "Confianza en la oración",

  // Purpose
  "All Things for Good": "Todas las cosas cooperan para bien",
  "The Lord's Purpose Prevails": "El propósito del Señor prevalece",
  "What Does the Lord Require": "¿Qué es lo que requiere el Señor?",
  "Do All for God's Glory": "Hacer todo para la gloria de Dios",
  "In Word or Deed": "De palabra o de hecho",
  "Created for His Glory": "Creado para su gloria",
  "Go and Make Disciples": "Ir y hacer discípulos",
  "Use Your Gifts": "Usar los dones",
  "Let Your Light Shine": "Hacer brillar la luz",
  "Living Sacrifices": "Sacrificios vivos",
  "Press Toward the Goal": "Proseguir hacia la meta",
  "Anointed to Proclaim": "Ungido para proclamar",
  "Formed and Known": "Formado y conocido",

  // Relationships
  "Love Is Patient": "El amor es paciente",
  "Be Completely Humble": "Ser completamente humildes",
  "Clothe Yourselves with Compassion": "Vestirse de compasión",
  "Devoted to One Another": "Dedicados los unos a los otros",
  "A Friend Loves": "Un amigo ama",
  "Submit to One Another": "Someterse unos a otros",
  "Value Others Above Yourself": "Considerar a los demás como superiores",
  "Love Covers Sins": "El amor cubre multitud de pecados",
  "Sweetness of a Friend": "La dulzura de un amigo",
  "Golden Rule": "Regla de oro",
  "Consider How to Spur": "Considerarse unos a otros para estimular",
  "Quick to Listen": "Pronto para oír",
  "Forgive Seventy-Seven Times": "Perdonar hasta setenta veces siete",
  "Gentle Answer Turns Away Wrath": "La respuesta blanda aplaca la ira",
  "Love Your Enemies": "Amar a sus enemigos",

  // Forgiveness
  "Bear with Each Other": "Soportarse unos a otros",
  "As Far as East Is from West": "Tan lejos como el oriente del occidente",
  "Seventy-Seven Times": "Setenta veces siete",
  "Father, Forgive Them": "Padre, perdónalos",
  "Blessed Is the One Whose Sin Is Forgiven": "Dichoso aquel cuyo pecado es perdonado",

  // Shame & Guilt
  "If We Confess": "Si confesamos",
  "Create in Me a Clean Heart": "Crea en mí un corazón limpio",

  // Surprising Bible
  "Bests and Mockers": "Los osos y los burladores",
  "Ehud's Sword": "La espada de Aod",
  "Eutychus Falls": "La caída de Eutico",
  "Coin in the Fish's Mouth": "La moneda en la boca del pez",
  "Floating Axe Head": "El hacha flotante",
  "Ravens Feed Elijah": "Los cuervos alimentan a Elías",

  // Wisdom
  "Fear of the Lord": "El temor del Señor",
  "Trust in the Lord": "Confianza en el Señor",
  "Wisdom Preserves": "La sabiduría preserva",

  // Shortest & Longest
  "Jesus Wept": "Jesús lloró",
  "The King's Decree": "El decreto del rey",
  "For God So Loved": "Tanto amó Dios",
  "Christ Died for Us": "Cristo murió por nosotros",
  "Comprehending Christ's Love": "Comprender el amor de Cristo",
  "Lavished Love": "Amor derramado",
  "God's Love Revealed": "El amor de Dios revelado",
  "Compassionate and Gracious": "Compasivo y clemente",
  "Never Failing Compassions": "Compasión que nunca falla",
  "Nothing Can Separate": "Nada puede separar",
  "He Rejoices Over You": "Él se regocija por ti",
  "His Love Endures Forever": "Su amor permanece para siempre",
  "Greater Love Has No One": "Nadie tiene mayor amor",
  "He Did Not Spare His Son": "No escatimó a su propio Hijo",
  "Love Never Fails": "El amor nunca deja de ser",
  "Rich in Mercy": "Rico en misericordia",
};

const DAY_THEME_TRANSLATIONS: Record<string, string> = {
  // Jesus
  "Jesus is eternal and incarnate": "Jesús es eterno y encarnado",
  "Christ's supremacy": "Supremacía de Cristo",
  "Christ as final revelation": "Cristo como la revelación final",
  "Salvation through Jesus": "Salvación a través de Jesús",
  "Christ's humility and exaltation": "Humildad y exaltación de Cristo",
  "Jesus as the only way": "Jesús como el único camino",
  "Rest in Jesus": "Descanso en Jesús",
  "Jesus the Good Shepherd": "Jesús el Buen Pastor",
  "Confessing Christ": "Confesar a Cristo",
  "Christ's resurrection and authority": "Resurrección y autoridad de Cristo",

  // Anxiety
  "Prayer and peace": "Oración y paz",
  "Inviting God's examination": "Invitar la examinación de Dios",
  "God cares for you": "Dios cuida de ti",
  "Comfort in anxiety": "Consuelo en la ansiedad",
  "God gives courage": "Dios da valentía",
  "Trust in God": "Confiar en Dios",
  "God hears and delivers": "Dios escucha y libra",
  "Encourage the anxious": "Animar al ansioso",
  "Trust in Jesus": "Confiar en Jesús",
  "Cast burdens on God": "Echar las cargas sobre Dios",
  "God's inseparable love": "Amor inseparable de Dios",
  "God's faithful love": "Amor fiel de Dios",
  "Looking to God": "Mirar a Dios",
  "Let Christ's peace rule": "Dejar reinar la paz de Cristo",

  // Burnout
  "Lord as Shepherd": "El Señor como Pastor",
  "God renews the weary": "Dios renueva al cansado",
  "Strength in weakness": "Fuerza en la debilidad",
  "Trust in God's sovereignty": "Confiar en la soberanía de Dios",
  "Rhythm of rest": "Ritmo de descanso",
  "Spiritual fervour": "Fervor espiritual",
  "Sabbath rest": "Reposo de Sabbat",
  "Perseverance in doing good": "Perseverancia en hacer el bien",
  "God provides rest": "Dios provee descanso",

  // Faith
  "Definition of faith": "Definición de fe",
  "Necessity of faith": "Necesidad de fe",
  "Source of faith": "Origen de la fe",
  "Living by faith": "Vivir de fe",
  "Faith in Christ": "Fe en Cristo",
  "Honest faith": "Fe honesta",
  "Living faith": "Fe viva",

  // Fear of Future
  "God's care for tomorrow": "Cuidado de Dios para el mañana",
  "God strengthens and helps": "Dios fortalece y ayuda",
  "Rely on God, not self": "Depender de Dios, no de uno mismo",
  "Peace of God": "Paz de Dios",
  "Confidence in God": "Confianza en Dios",
  "Trust and wait patiently": "Confiar y esperar pacientemente",
  "God is with you": "Dios está contigo",
  "God's presence in darkness": "Presencia de Dios en la oscuridad",
  "God's presence": "Presencia de Dios",
  "God is refuge and strength": "Dios es refugio y fortaleza",
  "Worry doesn't add life": "La preocupación no añade vida",
  "Safety in God's shelter": "Seguridad bajo el amparo de Dios",
  "Christ's peace": "La paz de Cristo",

  // For Students
  "Beginning of knowledge": "Principio del conocimiento",
  "Value of wisdom": "Valor de la sabiduría",
  "Work as for the Lord": "Trabajar como para el Señor",
  "Protection of wisdom": "Protección de la sabiduría",
  "Wisdom foundation": "Fundamento de la sabiduría",
  "Living by God's word": "Vivir por la palabra de Dios",
  "Study diligently": "Estudiar con diligencia",
  "Companions influence": "Influencia de los compañeros",
  "Contentment and strength (context matters)": "Contentamiento y fortaleza",
  "Divine gift of learning": "Regalo divino del aprendizaje",
  "Entrust your plans": "Encomendar tus planes",
  "Wholehearted search": "Búsqueda de todo corazón",
  "Rooted and built up": "Enraizados y edificados",
  "God's word brings light": "La palabra de Dios trae luz",

  // Grief
  "God's nearness in sorrow": "Cercanía de Dios en el dolor",
  "Comfort in mourning": "Consuelo en el luto",
  "Comfort others": "Consolar a otros",
  "God heals": "Dios sana",
  "Hope in Christ": "Esperanza en Cristo",
  "Eternal comfort": "Consuelo eterno",
  "Suffering vs glory": "Sufrimientos frente a la gloria",
  "Temporary sorrow": "Dolor temporal",
  "Believers' hope": "Esperanza de los creyentes",
  "Suffering Servant": "Siervo sufriente",
  "Deliverance": "Liberación",
  "God's compassion": "Compasión de Dios",
  "Finding grace": "Hallar gracia",
  "Unbreakable love": "Amor inquebrantable",

  // Hope
  "Hope through the Holy Spirit": "Esperanza a través del Espíritu Santo",
  "Personal hope": "Esperanza personal",
  "Hope through resurrection": "Esperanza a través de la resurrección",
  "Secure hope": "Esperanza segura",
  "Daily renewal": "Renovación diaria",
  "Patience in hope": "Paciencia en la esperanza",
  "Strength while waiting": "Fortaleza mientras esperamos",
  "Waiting in hope": "Esperar con esperanza",
  "Hope through suffering": "Esperanza a través del sufrimiento",
  "Persevering hope": "Esperanza perseverante",
  "God's faithfulness": "Fidelidad de Dios",
  "Hope motivates perseverance": "La esperanza motiva la perseverancia",
  "Hope of glory": "Esperanza de gloria",
  "Preaching hope to yourself": "Predicar esperanza a uno mismo",

  // Identity
  "Human dignity": "Dignidad humana",
  "Intrinsic worth": "Valor intrínseco",
  "Adoption in Christ": "Adopción en Cristo",
  "Transformation": "Transformación",
  "Union with Christ": "Unión con Cristo",
  "Created for good works": "Creado para buenas obras",
  "Belonging to God": "Pertenecer a Dios",
  "Inheritance": "Herencia",
  "Security in Christ": "Seguridad en Cristo",
  "Gifts and humility": "Dones y humildad",
  "Unity": "Unidad",
  "God's lavish love": "Amor generoso de Dios",
  "Eternal identity": "Identidad eterna",
  "Indwelling Spirit": "Espíritu habitando en ti",
  "Human worth": "Valor humano",

  // Loneliness
  "Crying out for company": "Clamar por compañía",
  "Belonging": "Pertenencia",
  "God's acceptance": "Aceptación de Dios",
  "Fearless companionship": "Compañía sin miedo",
  "Jesus' promise": "Promesa de Jesús",
  "Divine presence in trial": "Presencia divina en la prueba",

  // New Beginnings
  "Transformed life": "Vida transformada",
  "God's new work": "Nueva obra de Dios",
  "Inner transformation": "Transformación interna",
  "Leaving the past": "Dejar el pasado",
  "Proclaiming hope": "Proclamar esperanza",
  "Spiritual rebirth": "Renacimiento espiritual",
  "Grateful praise": "Alabanza agradecida",
  "Salvation and renewal": "Salvación y renovación",
  "Future restoration": "Restauración futura",

  // New Believer
  "Adoption": "Adopción",
  "Obedience": "Obediencia",
  "Resurrection life": "Vida de resurrección",
  "Continued growth": "Crecimiento continuo",
  "Spiritual nourishment": "Nutrición espiritual",
  "Practical holiness": "Santidad práctica",

  // Parenting
  "Guiding children": "Guiar a los niños",
  "Nurturing faith": "Nutrir la fe",
  "Encouraging parenting": "Crianza alentadora",
  "Everyday discipleship": "Discipulado diario",
  "Value of children": "Valor de los hijos",
  "Wisdom from parents": "Sabiduría de los padres",
  "Early scripture teaching": "Enseñanza temprana de la Escritura",

  // Peace
  "Steadfast trust": "Confianza firme",
  "Peace that guards": "Paz que resguarda",
  "Blessing of peace": "Bendición de paz",
  "Justification by faith": "Justificación por la fe",
  "Safety and rest": "Seguridad y descanso",
  "Peace in relationships": "Paz en las relaciones",
  "Pursuing peace": "Buscar la paz",
  "Love for God's law": "Amor por la ley de Dios",
  "Peacemaking": "Pacificador",

  // Prayer
  "The Lord's Prayer": "El Padre Nuestro",
  "Prayer and thanksgiving": "Oración y acción de gracias",
  "Continual prayer": "Oración constante",
  "Power of confession and prayer": "Poder de la confesión y oración",
  "Persistence in prayer": "Persistencia en la oración",
  "Faith-filled prayer": "Oración llena de fe",
  "Asking according to God's will": "Pedir según la voluntad de Dios",

  // Purpose
  "God's sovereignty": "Soberanía de Dios",
  "God's plans vs ours": "Planes de Dios contra los nuestros",
  "Justice and humility": "Justicia y humildad",
  "Motivation": "Motivación",
  "All-encompassing purpose": "Propósito omnímodo",
  "Ultimate reason for existence": "Razón última de la existencia",
  "Great Commission": "La Gran Comisión",
  "Serving others": "Servir a los demás",
  "Dependence on God": "Dependencia de Dios",
  "Witness": "Testimonio",
  "Whole-life worship": "Toda la vida como adoración",
  "Eternal prize": "Premio eterno",
  "Mission": "Misión",
  "God's call (context-specific)": "Llamado de Dios",

  // Relationships
  "Humility and unity": "Humildad y unidad",
  "Christ-like character": "Carácter como el de Cristo",
  "Affection and honour": "Afecto y honra",
  "Loyal friendship": "Amistad leal",
  "Mutual submission": "Sumisión mutua",
  "Humility and service": "Humildad y servicio",
  "Forgiving love": "Amor que perdona",
  "Counsel and encouragement": "Consejo y aliento",
  "Treat others well": "Tratar bien a los demás",
  "Mutual encouragement": "Aliento mutuo",
  "Gentle communication": "Comunicación amable",
  "Peaceful speech": "Habla pacífica",
  "Mercy and love": "Misericordia y amor",

  // Forgiveness
  "Gift of salvation": "Regalo de la salvación",
  "Completing forgiveness": "Perdón completo",
  "Forgiving as Christ forgave": "Perdonar como Cristo perdonó",
  "Complete forgiveness": "Perdón completo",
  "God's mercy": "Misericordia de Dios",
  "Unlimited forgiveness": "Perdón ilimitado",
  "Jesus' example": "Ejemplo de Jesús",
  "Reconciliation": "Reconciliación",
  "Blessing of forgiveness": "Bendición de perdón",

  // Shame & Guilt
  "Forgiveness and joy": "Perdón y gozo",
  "Freedom in Christ": "Libertad en Cristo",
  "Confession and cleansing": "Confesión y limpieza",
  "Restoration": "Restauración",
  "Grace over guilt": "La gracia sobre la culpa",
  "Repentance": "Arrepentimiento",

  // Surprising Bible
  "Unexpected messenger": "Mensajero inesperado",
  "Respect God's servants": "Respetar a los siervos de Dios",
  "Unexpected deliverance": "Liberación inesperada",
  "Miraculous rescue": "Rescate milagroso",
  "Provision": "Provisión",
  "Miraculous assistance": "Asistencia milagrosa",
  "Surprising provision": "Provisión sorpresiva",

  // Wisdom
  "Starting point": "Punto de partida",
  "Asking for wisdom": "Pedir la sabiduría",
  "Lean on God's understanding": "Apoyarse en el entendimiento de Dios",
  "Source of wisdom": "Fuente de sabiduría",
  "Protection": "Protección",
  "Pursue wisdom": "Perseguir la sabiduría",
  "Teaching and admonishing": "Enseñanza y amonestación",

  // Shortest & Longest
  "Jesus' compassion": "La compasión de Jesús",
  "Detailed decree": "Decreto detallado",
  "God's gift": "Regalo de Dios",
  "Demonstration of love": "Demostración de amor",
  "Understanding love": "Comprender el amor",
  "Our identity": "Nuestra identidad",
  "God's initiative": "Iniciativa de Dios",
  "Steadfast love": "Amor inquebrantable",
  "Unending mercies": "Misericordia infinita",
  "Secure love": "Amor seguro",
  "God's delight": "El deleite de Dios",
  "Enduring love": "Amor eterno",
  "Sacrificial love": "Amor sacrificial",
  "God's generosity": "Generosidad de Dios",
  "Grace and love": "Gracia y amor",
};

export function getLocalizedPathDay<T>(day: T, isEs: boolean): T {
  if (!day) return day;
  if (!isEs) return day;
  
  // Custom paths created by user can bypass translation
  if ((day as any).isCustom) return day;

  const title = (day as any).title;
  const theme = (day as any).theme;
  
  const translatedTitle = title ? ((day as any).titleEs || DAY_TITLE_TRANSLATIONS[title] || title) : undefined;
  const translatedTheme = theme ? ((day as any).themeEs || DAY_THEME_TRANSLATIONS[theme] || theme) : undefined;
  
  return {
    ...day,
    title: translatedTitle,
    theme: translatedTheme,
  } as T;
}

/**
 * Gets the current local date in YYYY-MM-DD format.
 */
export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Standard layout constants for the verse to ensure visual consistency.
 */
export const VERSE_LAYOUT = {
  MAX_CHARS_PER_LINE: 28, // Slightly wider for a more modern open feel
  FONT_SIZE_CLASSES: "text-[21px] sm:text-3xl md:text-4xl",
  LINE_HEIGHT: "leading-[1.5]",
  FONT_WEIGHT: "font-black",
  CHAR_HEIGHT: "h-9 sm:h-12 md:h-14", 
};

/**
 * Splits a verse text into lines of roughly equal length, respecting word boundaries.
 * This ensures consistent layout across different views.
 */
export function getVerseLines(text: string | null | undefined, maxCharsPerLine: number = VERSE_LAYOUT.MAX_CHARS_PER_LINE): string[] {
  if (!text) return [];
  
  // If text already has line breaks, respect them
  if (text.includes('\n')) {
    return text.split('\n');
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = "";

  words.forEach(word => {
    if ((currentLine + word).length > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  });

  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }

  return lines;
}

/**
 * Removes accents and diacritics from a string.
 */
export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
