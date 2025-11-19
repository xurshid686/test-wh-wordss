const fetch = require('node-fetch');

module.exports = async (req, res) => {
  console.log('🔔 API endpoint called');
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight request handled');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    console.log('📥 Received POST request');
    
    // Parse JSON body
    let testData;
    if (typeof req.body === 'string') {
      try {
        testData = JSON.parse(req.body);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON data'
        });
      }
    } else {
      testData = req.body;
    }

    console.log('👤 Student:', testData.studentName);
    console.log('📊 Questions:', testData.questions?.length);

    // Validate required fields
    if (!testData.studentName || !testData.questions) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: studentName and questions are required'
      });
    }

    // Calculate results
    const totalQuestions = testData.questions.length;
    const correctAnswers = testData.questions.filter(q => 
      q.selected !== undefined && q.selected === q.correct
    ).length;
    const unansweredQuestions = testData.questions.filter(q => 
      q.selected === undefined
    ).length;
    const wrongAnswers = totalQuestions - correctAnswers - unansweredQuestions;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    // Format time
    const minutesSpent = Math.floor((testData.timeSpent || 0) / 60);
    const secondsSpent = (testData.timeSpent || 0) % 60;
    const timeSpentFormatted = `${minutesSpent}m ${secondsSpent}s`;

    const minutesLeft = Math.floor((testData.timeLeft || 0) / 60);
    const secondsLeft = (testData.timeLeft || 0) % 60;
    const timeLeftFormatted = `${minutesLeft}m ${secondsLeft}s`;

    // Determine submission reason
    let submissionReason = 'Manual submission';
    if (testData.timeLeft <= 0) {
      submissionReason = 'Time expired';
    } else if (testData.leaveCount > 3) {
      submissionReason = 'Too many page leaves';
    }

    // Get environment variables
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    console.log('🔧 Environment check:');
    console.log('   TELEGRAM_BOT_TOKEN:', TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('   TELEGRAM_CHAT_ID:', TELEGRAM_CHAT_ID ? '✅ Set' : '❌ Missing');

    // Create detailed report for Telegram
    let report = `🎓 *ENGLISH TEST SUBMISSION*\n\n`;
    report += `👤 *Student:* ${testData.studentName}\n`;
    report += `⏱️ *Time Spent:* ${timeSpentFormatted}\n`;
    report += `⏰ *Time Left:* ${timeLeftFormatted}\n`;
    report += `📊 *Score:* ${correctAnswers}/${totalQuestions} (${score}%)\n`;
    report += `✅ *Correct:* ${correctAnswers}\n`;
    report += `❌ *Wrong:* ${wrongAnswers}\n`;
    report += `⏭️ *Unanswered:* ${unansweredQuestions}\n`;
    report += `🚪 *Page Leaves:* ${testData.leaveCount || 0}\n`;
    report += `🎯 *Submission:* ${submissionReason}\n`;
    report += `📅 *Submitted:* ${new Date().toLocaleString()}\n\n`;

    report += `*DETAILED RESULTS:*\n`;
    report += `═══════════════════════════════\n\n`;

    // Add each question with detailed analysis
    testData.questions.forEach((q, index) => {
      const isCorrect = q.selected !== undefined && q.selected === q.correct;
      const isUnanswered = q.selected === undefined;
      const selectedOption = q.selected !== undefined ? q.options[q.selected] : '❌ *Not answered*';
      const correctOption = q.options[q.correct];
      
      let emoji = '❌';
      let status = 'Wrong';
      if (isCorrect) {
        emoji = '✅';
        status = 'Correct';
      }
      if (isUnanswered) {
        emoji = '⏭️';
        status = 'Unanswered';
      }
      
      report += `${emoji} *Question ${index + 1}:* ${q.question}\n`;
      report += `   *Student's Answer:* ${selectedOption}\n`;
      report += `   *Correct Answer:* ${correctOption}\n`;
      report += `   *Status:* ${status}\n\n`;
    });

    // Summary
    report += `═══════════════════════════════\n`;
    report += `*SUMMARY*\n`;
    report += `🏆 *Final Score:* ${score}%\n`;
    report += `📈 *Performance:* ${score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Average' : 'Needs Improvement'}\n`;
    report += `⏱️ *Completion Time:* ${timeSpentFormatted}\n`;

    console.log('📋 Generated report for Telegram');

    // Send to Telegram if configured
    let telegramSent = false;
    let telegramError = null;

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        console.log('📤 Sending to Telegram...');
        await sendToTelegram(report, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
        telegramSent = true;
        console.log('✅ Telegram notification sent successfully');
      } catch (error) {
        telegramError = error.message;
        console.error('❌ Telegram error:', error.message);
      }
    } else {
      console.log('ℹ️ Telegram not configured - environment variables missing');
      console.log('📧 Report that would be sent to Telegram:');
      console.log(report);
    }

    // Log to console for Vercel logs
    console.log('🎯 Test submitted by:', testData.studentName);
    console.log('📈 Score:', `${correctAnswers}/${totalQuestions} (${score}%)`);
    console.log('⏱️ Time spent:', timeSpentFormatted);
    console.log('📤 Telegram sent:', telegramSent);
    if (telegramError) {
      console.log('📧 Telegram error:', telegramError);
    }

    // Return success response
    const responseData = {
      success: true,
      message: 'Test submitted successfully',
      data: {
        studentName: testData.studentName,
        score: `${correctAnswers}/${totalQuestions}`,
        percentage: score,
        telegramSent: telegramSent,
        telegramError: telegramError
      }
    };

    console.log('✅ Sending success response');
    res.status(200).json(responseData);

  } catch (error) {
    console.error('💥 Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

async function sendToTelegram(message, botToken, chatId) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  console.log('💬 Sending Telegram message to chat:', chatId);
  
  // Split long messages (Telegram has a 4096 character limit)
  if (message.length > 4000) {
    console.log('📄 Message too long, splitting into parts...');
    
    // Send in parts
    const part1 = message.substring(0, 4000) + '\n\n... (continued)';
    const part2 = '... (continued)\n\n' + message.substring(4000);
    
    await sendSingleMessage(part1, url, chatId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await sendSingleMessage(part2, url, chatId);
  } else {
    await sendSingleMessage(message, url, chatId);
  }
}

async function sendSingleMessage(text, url, chatId) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    })
  });

  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(result.description || `Telegram API error: ${JSON.stringify(result)}`);
  }
  
  return result;
}
