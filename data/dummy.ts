import { Voter, Group, GroupLeader, DivisionHead, Status, CallStatus, ConversationLog, AppUser } from "@/types";

export const initialStatuses: Status[] = [
  { id: "st1", name: "תומך", color: "#16a34a", isDefault: false },
  { id: "st2", name: "מתנגד", color: "#dc2626", isDefault: false },
  { id: "st3", name: "מתלבט", color: "#f59e0b", isDefault: true },
];

export const initialCallStatuses: CallStatus[] = [
  { id: "cs1", name: "ענה", color: "#16a34a" },
  { id: "cs2", name: "לא ענה", color: "#6b7280" },
  { id: "cs3", name: "הושארה הודעה", color: "#2563eb" },
  { id: "cs4", name: "מספר שגוי", color: "#dc2626" },
  { id: "cs5", name: "בקשה לחזור", color: "#d97706" },
];

export const initialUsers: AppUser[] = [
  {
    id: "usr1",
    firstName: "בנימין",
    lastName: "זיידנר",
    email: "admin@election.co.il",
    phone: "050-0000001",
    role: "admin",
    isFrozen: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    password: "admin123",
  },
  {
    id: "usr2",
    firstName: "דנה",
    lastName: "כץ",
    email: "dana@election.co.il",
    phone: "050-0000002",
    role: "telemarketing",
    isFrozen: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    password: "dana123",
  },
  {
    id: "usr3",
    firstName: "אורי",
    lastName: "ברק",
    email: "uri@election.co.il",
    phone: "050-0000003",
    role: "group_leader",
    isFrozen: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    password: "uri123",
  },
  {
    id: "usr4",
    firstName: "מיכל",
    lastName: "שפיר",
    email: "michal@election.co.il",
    phone: "050-0000004",
    role: "division_head",
    isFrozen: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    password: "michal123",
  },
  {
    id: "usr5",
    firstName: "רועי",
    lastName: "אדם",
    email: "roi@election.co.il",
    phone: "050-0000005",
    role: "field",
    isFrozen: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    password: "roi123",
  },
];

export const initialDivisionHeads: DivisionHead[] = [
  {
    id: "dh1",
    firstName: "צחי",
    lastName: "זליכה",
    uniqueId: "012345678",
    phone: "052-1234567",
    email: "tzachi@example.com",
    groupLeaderIds: ["gl1", "gl2"],
  },
  {
    id: "dh2",
    firstName: "רונית",
    lastName: "שמיר",
    uniqueId: "023456789",
    phone: "054-9876543",
    email: "ronit@example.com",
    groupLeaderIds: ["gl3", "gl4"],
  },
];

export const initialGroupLeaders: GroupLeader[] = [
  {
    id: "gl1",
    firstName: "אורי",
    lastName: "מאני",
    uniqueId: "034567890",
    phone: "050-1112233",
    email: "uri@example.com",
    divisionHeadId: "dh1",
    groupIds: ["g1", "g2"],
  },
  {
    id: "gl2",
    firstName: "מיכל",
    lastName: "לוי",
    uniqueId: "045678901",
    phone: "052-4445566",
    email: "michal@example.com",
    divisionHeadId: "dh1",
    groupIds: ["g3"],
  },
  {
    id: "gl3",
    firstName: "דני",
    lastName: "כהן",
    uniqueId: "056789012",
    phone: "054-7778899",
    email: "dani@example.com",
    divisionHeadId: "dh2",
    groupIds: ["g4"],
  },
  {
    id: "gl4",
    firstName: "יעל",
    lastName: "אברהם",
    uniqueId: "067890123",
    phone: "058-0001122",
    email: "yael@example.com",
    divisionHeadId: "dh2",
    groupIds: ["g5"],
  },
];

export const initialGroups: Group[] = [
  {
    id: "g1",
    name: "הורים - בית ספר יסודי (כיתות א)",
    groupLeaderId: "gl1",
    voterIds: ["v1", "v2", "v3", "v5"],
  },
  {
    id: "g2",
    name: "הורים - גני ילדים",
    groupLeaderId: "gl1",
    voterIds: ["v1", "v4", "v6", "v7"],
  },
  {
    id: "g3",
    name: "אמהות ואבות חד הוריים",
    groupLeaderId: "gl2",
    voterIds: ["v8", "v9", "v10", "v11"],
  },
  {
    id: "g4",
    name: "ותיקי השכונה",
    groupLeaderId: "gl3",
    voterIds: ["v12", "v13", "v14", "v15", "v16"],
  },
  {
    id: "g5",
    name: "בעלי עסקים",
    groupLeaderId: "gl4",
    voterIds: ["v17", "v18", "v19", "v20"],
  },
];

export const initialVoters: Voter[] = [
  { id: "v1", firstName: "בנימין", lastName: "זיידנר", uniqueId: "060734282", phone: "050-1234567", address: { street: "אורלנסקי", streetNumber: "13", building: "", apartment: "17", city: "פתח תקווה" }, groupIds: ["g1", "g2"], statusId: "st1" },
  { id: "v2", firstName: "שרה", lastName: "זיידנר", uniqueId: "060734283", phone: "050-1234568", address: { street: "אורלנסקי", streetNumber: "13", building: "", apartment: "17", city: "פתח תקווה" }, groupIds: ["g1"], statusId: "st3" },
  { id: "v3", firstName: "יוסף", lastName: "כהן", uniqueId: "071234567", phone: "052-2345678", address: { street: "ביאליק", streetNumber: "5", building: "א", apartment: "3", city: "פתח תקווה" }, groupIds: ["g1"], statusId: "st1" },
  { id: "v4", firstName: "רחל", lastName: "לוי", uniqueId: "082345678", phone: "052-2345679", address: { street: "הרצל", streetNumber: "22", building: "", apartment: "8", city: "פתח תקווה" }, groupIds: ["g2"], statusId: "st2" },
  { id: "v5", firstName: "דוד", lastName: "מזרחי", uniqueId: "093456789", phone: "054-3456789", address: { street: "ויצמן", streetNumber: "10", building: "ב", apartment: "12", city: "פתח תקווה" }, groupIds: ["g1"], statusId: "st1" },
  { id: "v6", firstName: "חנה", lastName: "פרץ", uniqueId: "104567890", phone: "054-3456780", address: { street: "אורלנסקי", streetNumber: "13", building: "", apartment: "4", city: "פתח תקווה" }, groupIds: ["g2"], statusId: "st3" },
  { id: "v7", firstName: "אברהם", lastName: "גולדברג", uniqueId: "115678901", phone: "058-4567890", address: { street: "בן גוריון", streetNumber: "7", building: "", apartment: "2", city: "פתח תקווה" }, groupIds: ["g2"], statusId: "st1" },
  { id: "v8", firstName: "מרים", lastName: "שפירא", uniqueId: "126789012", phone: "058-4567891", address: { street: "רוטשילד", streetNumber: "18", building: "ג", apartment: "5", city: "פתח תקווה" }, groupIds: ["g3"], statusId: "st2" },
  { id: "v9", firstName: "נחום", lastName: "ברק", uniqueId: "137890123", phone: "050-5678901", address: { street: "ז'בוטינסקי", streetNumber: "3", building: "", apartment: "9", city: "פתח תקווה" }, groupIds: ["g3"], statusId: "st3" },
  { id: "v10", firstName: "לאה", lastName: "שלום", uniqueId: "148901234", phone: "050-5678902", address: { street: "הנביאים", streetNumber: "11", building: "", apartment: "6", city: "פתח תקווה" }, groupIds: ["g3"], statusId: "st1" },
  { id: "v11", firstName: "משה", lastName: "אלון", uniqueId: "159012345", phone: "052-6789012", address: { street: "הנביאים", streetNumber: "11", building: "", apartment: "7", city: "פתח תקווה" }, groupIds: ["g3"], statusId: "st3" },
  { id: "v12", firstName: "תמר", lastName: "נחמן", uniqueId: "160123456", phone: "052-6789013", address: { street: "אחד העם", streetNumber: "30", building: "", apartment: "1", city: "פתח תקווה" }, groupIds: ["g4"], statusId: "st1" },
  { id: "v13", firstName: "שלמה", lastName: "דוד", uniqueId: "171234567", phone: "054-7890123", address: { street: "אחד העם", streetNumber: "30", building: "", apartment: "2", city: "פתח תקווה" }, groupIds: ["g4"], statusId: "st2" },
  { id: "v14", firstName: "עדי", lastName: "פישר", uniqueId: "182345678", phone: "054-7890124", address: { street: "שינקין", streetNumber: "6", building: "א", apartment: "14", city: "פתח תקווה" }, groupIds: ["g4"], statusId: "st3" },
  { id: "v15", firstName: "גיל", lastName: "מור", uniqueId: "193456789", phone: "058-8901234", address: { street: "שינקין", streetNumber: "6", building: "א", apartment: "15", city: "פתח תקווה" }, groupIds: ["g4"], statusId: "st1" },
  { id: "v16", firstName: "נועה", lastName: "שגב", uniqueId: "204567890", phone: "058-8901235", address: { street: "דיזנגוף", streetNumber: "44", building: "", apartment: "11", city: "פתח תקווה" }, groupIds: ["g4"], statusId: "st3" },
  { id: "v17", firstName: "יואב", lastName: "קפלן", uniqueId: "215678901", phone: "050-9012345", address: { street: "סוקולוב", streetNumber: "9", building: "", apartment: "3", city: "פתח תקווה" }, groupIds: ["g5"], statusId: "st2" },
  { id: "v18", firstName: "אורית", lastName: "הרשקוביץ", uniqueId: "226789012", phone: "052-9012346", address: { street: "סוקולוב", streetNumber: "9", building: "", apartment: "4", city: "פתח תקווה" }, groupIds: ["g5"], statusId: "st1" },
  { id: "v19", firstName: "רן", lastName: "אוחנה", uniqueId: "237890123", phone: "054-0123456", address: { street: "קפלן", streetNumber: "2", building: "ב", apartment: "20", city: "פתח תקווה" }, groupIds: ["g5"], statusId: "st3" },
  { id: "v20", firstName: "ליאת", lastName: "בן דוד", uniqueId: "248901234", phone: "054-0123457", address: { street: "קפלן", streetNumber: "2", building: "ב", apartment: "21", city: "פתח תקווה" }, groupIds: ["g5"], statusId: "st1" },
];

export const initialConversationLogs: ConversationLog[] = [
  { id: "cl1", voterId: "v1", userId: "usr1", timestamp: "2026-05-20T10:30:00.000Z", callStatus: "answered", statusId: "st1", notes: "שיחה חיובית מאוד. מאשר תמיכה מלאה. מוכן לעזור בקמפיין ולהביא חברים." },
  { id: "cl2", voterId: "v1", userId: "usr2", timestamp: "2026-05-15T14:00:00.000Z", callStatus: "no_answer", statusId: "st3", notes: "" },
  { id: "cl3", voterId: "v4", userId: "usr2", timestamp: "2026-05-22T09:15:00.000Z", callStatus: "answered", statusId: "st2", notes: "מתנגד. אינו מעוניין בשיחה נוספת." },
  { id: "cl4", voterId: "v7", userId: "usr1", timestamp: "2026-05-21T16:45:00.000Z", callStatus: "left_message", statusId: "st3", notes: "הושארה הודעה, ביקשתי שיחזור." },
  { id: "cl5", voterId: "v10", userId: "usr2", timestamp: "2026-05-23T11:00:00.000Z", callStatus: "answered", statusId: "st1", notes: "תומכת נלהבת. תגיע לקלפי ותביא שכנות." },
];
