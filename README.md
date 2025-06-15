# Swipe Model Roulette

Ever swipe in a roleplay and noticed the swipe was 90% similar to the last one? Me too. This extension helps with that.

![First swipe example](images/example1.png)
![Second swipe example](images/example2.png)

(different swipes, but they're similar due to how LLM's behave)

## What it does

Automatically switches between different connection profiles when you swipe, giving you more varied responses. Each swipe uses a random connection profile based on the weights you set.

This extension will not randomly switch the model with regular messages, only swipes. So use a strong model as a base.

![Extension settings](images/extensionsettings.png)

## Different ways for using this extension
1. Adding swipe variety by hooking up multiple models (for example you can randomly choose to have opus on your swipes, another gpt 4.5, another deepseek etc)
2. You could maybe have a local + corpo model config
3. Connection profiles support presets, so you dont HAVE to change the model, for example with each swipe you could randomly choose between one of your different presets so the writing style changes while you are still using the same model
4. You could even set it up to where one swipe you could set the temperature to 0.9, another for 0.7, etc.
   
## Installation

1. Paste this link in SillyTavern's extension installer:
   ```
   https://github.com/notstat/SwipeModelRoulette
   ```

2. Add at least one connection profile in SillyTavern to use this extension

3. Set the percentages for each model in the extension settings

That's it. Now your swipes will automatically use different models.
