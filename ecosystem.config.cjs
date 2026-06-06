module.exports = {
  apps: [
    {
      name: "idea-compiler",
      script: "./dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 5040,
      },
    },
  ],
};
