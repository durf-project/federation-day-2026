/* Settings for the Federation Day slides.

   QUIZ_BACKEND: where the quiz answers go.
   - "demo": nothing leaves the browser. Answers travel between tabs of the same browser
     (BroadcastChannel), so you can rehearse with the slides in one tab and #quiz in another.
     On the quiz slides, press D to add some random demo answers.
   - A live service (for phones in the room) can be plugged into quiz.js later: it only needs
     publish() and subscribe(). See README.md. */
window.DURF_DAY = {
  QUIZ_BACKEND: "demo",
  QUIZ_SOURCE: "quiz/questions.md",
  // Where the slides take their content from, so it stays the same as on the sites.
  PROJECT_PAGE: "https://durf-project.github.io/project-page/",
  POSITION_PAPER_MD: "https://durf-project.github.io/position-paper/position-paper.md",
  // Photos of speakers not in project-page/content/people.json: [file in project-page/assets/people/, source link]
  EXTRA_PHOTOS: {
    "Jeroen Bosman": ["https://durf-project.github.io/project-page/assets/people/jeroen-bosman.jpg",
      "https://media.licdn.com/dms/image/sync/v2/D4E27AQGrs-O3SD_fvA/articleshare-shrink_1280_800/articleshare-shrink_1280_800/0/1733743399499?e=2147483647&v=beta&t=DF7haOGHkl8IuBB_0K4o7Ebgly_gV-rXUoGEU8deusE"]
  }
};
