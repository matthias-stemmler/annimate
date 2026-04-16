describe('Update', () => {
  it('should show available update', async () => {
    await $('aria/Update available').waitForExist();
  });
});
