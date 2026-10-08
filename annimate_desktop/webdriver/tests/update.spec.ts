describe('Update', () => {
  it('should show available update', async () => {
    await $('role/dialog[name="Update available"]').waitForExist();
  });
});
