/* CJRM v1.0.0 — shared constants. Nothing here is a real client or secret. */
(function (global) {
  const CJRM = global.CJRM || (global.CJRM = {});

  CJRM.VERSION = "1.0.0";
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
    kijiji: { short: "KJ", name: "Kijiji" },
    facebook: { short: "FB", name: "Facebook" },
    instagram: { short: "IG", name: "Instagram" },
    whatsapp: { short: "WA", name: "WhatsApp" },
    phone1: { short: "SH", name: "Shop line" },
    phone2: { short: "PE", name: "Personal line" },
    web: { short: "WEB", name: "Website" },
    email: { short: "EM", name: "Email" },
    manual: { short: "IN", name: "Manual" },
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
    seenHubIds: [],
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
    "manual lead",
  ];
})(window);
