// Navigation shared by the Chatbot specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { chatbotsPage } from '../../src/pages/ChatbotsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';

/** Restarts the app signed in and opens More > Chatbots. */
export async function openChatbots(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await $(chatbotsPage.selectors.moreEntry).click();
  await chatbotsPage.waitForDisplayed(20_000);
  await chatbotsPage.waitForLoaded();
}

