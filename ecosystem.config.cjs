module.exports = {
  apps: [
    {
      name: "idea-compiler",
      script: "./dist/index.cjs",
      env: {
        NODE_ENV: "production",
        PORT: 5040,
      },
    },
  ],
};
