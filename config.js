/* Settings for the Federation Day slides.

   QUIZ_BACKEND: where the quiz answers go.
   - "ntfy": live. Phones and the slides exchange small messages through an ntfy server
     (https://ntfy.sh by default, or your own, see NTFY_SERVER). The slides publish which
     question is open on <topic>-state; phones send their answer to <topic>-answers.
   - "demo": nothing leaves the browser. Answers travel between tabs of the same browser
     (BroadcastChannel), so you can rehearse with the slides in one tab and #quiz in another.
     On the quiz slides, press D to add some random demo answers.
   You can also switch per visit: add ?quiz=demo or ?quiz=ntfy to the address.

   NTFY_TOPIC: anyone who knows the topic can read and send quiz messages, so keep it long and
   random, and pick a new one for a next event. Answers and the optional first name travel
   through the ntfy server; nothing else is sent. */
window.DURF_DAY = {
  QUIZ_BACKEND: "ntfy",
  NTFY_SERVER: "https://ntfy.sh",
  NTFY_TOPIC: "durf-fedday-2026-7f66016ea781fae0",
  QUIZ_SOURCE: "quiz/questions.md",
  QUIZ_SECONDS: 20,                 // how long each question stays open (can be changed in the ⚙ settings)
  // Where the slides take their content from, so it stays the same as on the sites.
  PROJECT_PAGE: "https://durf-project.github.io/project-page/",
  POSITION_PAPER_MD: "https://durf-project.github.io/position-paper/position-paper.md",
  // Photos of speakers not in project-page/content/people.json: [file in project-page/assets/people/, source link]
  EXTRA_PHOTOS: {
    "Jeroen Bosman": ["https://durf-project.github.io/project-page/assets/people/jeroen-bosman.jpg",
      "https://media.licdn.com/dms/image/sync/v2/D4E27AQGrs-O3SD_fvA/articleshare-shrink_1280_800/articleshare-shrink_1280_800/0/1733743399499?e=2147483647&v=beta&t=DF7haOGHkl8IuBB_0K4o7Ebgly_gV-rXUoGEU8deusE"]
  }
};
