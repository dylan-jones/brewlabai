self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all(
      ["apis", "pages", "start-url"].map((name) => caches.delete(name)),
    ),
  );
});
