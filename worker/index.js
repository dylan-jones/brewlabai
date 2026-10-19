self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all(
      ["apis", "pages", "start-url", "brew-shell"].map((name) => caches.delete(name)),
    ),
  );
});
