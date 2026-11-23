/* CJRM v1.1.6 — shared constants. Nothing here is a real client or secret. */
(function (global) {
  const CJRM = global.CJRM || (global.CJRM = {});

  CJRM.VERSION = "1.1.6";
  CJRM.APP_NAME = "CJRM";
  CJRM.APP_TITLE = "Carpenter Johnny Relationship Management";
  CJRM.STORAGE_KEY = "cjrm-v1";
  CJRM.PHOTO_DB = "cjrm-v1-photos";
  CJRM.SLIP_HOURS = 2;

  CJRM.CHANNELS = [
    "kijiji",
    "facebook",
    "instagram",
    "whatsapp",
    "phone1",
    "phone2",
    "web",
    "email",
    "manual",
  ];

  CJRM.CHANNEL_META = {
    kijiji: { short: "KJ", name: "Kijiji", badge: "Kijiji" },
    facebook: { short: "FB", name: "Facebook", badge: "Facebook" },
    instagram: { short: "IG", name: "Instagram", badge: "Instagram" },
    whatsapp: { short: "WA", name: "WhatsApp", badge: "WhatsApp" },
    phone1: { short: "WPG", name: "Winnipeg number", badge: "Winnipeg" },
    phone2: { short: "TOR", name: "Toronto number", badge: "Toronto" },
    web: { short: "WEB", name: "Website form", badge: "Website form" },
    email: { short: "EM", name: "Email", badge: "Email" },
    manual: { short: "IN", name: "Manual", badge: "Manual" },
  };

  CJRM.STAGES = ["new", "contacted", "quoted", "booked", "done", "lost"];

  CJRM.STAGE_META = {
    new: { name: "New lead", blurb: "Just in. No reply yet." },
    contacted: { name: "Contacted", blurb: "A reply has gone out." },
    quoted: { name: "Quote sent", blurb: "A number is in their hands." },
    booked: { name: "Booked", blurb: "A time is set." },
    done: { name: "Done", blurb: "Job finished. Leaves the open list." },
    lost: { name: "Lost", blurb: "Not a fit. Leaves the open list." },
  };

  CJRM.CLOSED_STAGES = ["done", "lost"];

  CJRM.DEFAULT_TEMPLATES = [
    {
      id: "thanks",
      title: "Thanks, I'll reply today",
      body: "Thanks for getting in touch. I'll get back to you today.",
    },
    {
      id: "measure",
      title: "Book a measure",
      body: "I can come by to measure. What day works for you?",
    },
    {
      id: "quote",
      title: "Quote is on the way",
      body: "The quote is on its way. Let me know if you have questions.",
    },
    {
      id: "booked",
      title: "See you then",
      body: "You're booked. I'll see you then.",
    },
  ];

  CJRM.DEFAULT_SETTINGS = {
    hubUrl: "",
    hubSecret: "",
    shopPhone: "",
    personalPhone: "",
    pollMinutes: 5,
    lastPollAt: null,
    lastPollOk: null,
    lastPollError: "",
    lastPollFetched: 0,
    lastPollFiled: 0,
    seenHubIds: [],
    onboarded: false,
  };

  CJRM.GENERIC_NAMES = [
    "new lead",
    "kijiji lead",
    "facebook lead",
    "instagram lead",
    "whatsapp lead",
    "website lead",
    "email lead",
    "shop line lead",
    "personal line lead",
    "winnipeg number lead",
    "toronto number lead",
    "manual lead",
  ];
})(window);
