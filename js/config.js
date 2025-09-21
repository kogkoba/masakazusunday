window.APP_CONFIG = {
  // 予備（fallback）用に残しておく：export?format=csv で使うときだけ参照
  SPREADSHEET_ID: "1L3dUsXqIPQSAhZJE1VbduKXJeABrx2Ob3w1YfqXG4aA",

  // もし gid 経由で読むならこちら（今回は使わなくてもOK）
  SUBJECT_GIDS: {
    "国語": 162988483,
    "算数": 0,
    "理科": 1839969673,
    "社会": 2143649641
  },

  // ★今回追加：各科目の “公開CSV” フルURL（これを最優先で使う）
  SUBJECT_CSV_URLS: {
    "算数": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTGjqCObqypFo6bo5XO2YfWSCOihywn7GriNhdYFha4WD_raEtyJ0WjpllvjTmt-wqRUWyojWdi97JP/pub?gid=0&single=true&output=csv",
    "国語": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTGjqCObqypFo6bo5XO2YfWSCOihywn7GriNhdYFha4WD_raEtyJ0WjpllvjTmt-wqRUWyojWdi97JP/pub?gid=162988483&single=true&output=csv",
    "理科": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTGjqCObqypFo6bo5XO2YfWSCOihywn7GriNhdYFha4WD_raEtyJ0WjpllvjTmt-wqRUWyojWdi97JP/pub?gid=1839969673&single=true&output=csv",
    "社会": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTGjqCObqypFo6bo5XO2YfWSCOihywn7GriNhdYFha4WD_raEtyJ0WjpllvjTmt-wqRUWyojWdi97JP/pub?gid=2143649641&single=true&output=csv"
  },

  GAS_ENDPOINT: "https://script.google.com/macros/s/AKfycbx9PKDGh-a5AkeSz5sPlJlCsJZSZGYa7iqCnIcLaCFAk1iHo0mi7T-RlLbZcTzWf9HBJw/exec",

  COLS: { id:"id", week:"week", question:"question", answer:"answer", alt:"alt_answers", image:"image_url", flag:"enabled" }
};
