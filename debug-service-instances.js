const ServiceManager = require('./src/core/service-manager');

async function compareServiceInstances() {
  try {
    console.log('🔍 Comparing Service Instances and Data Access...\n');
    
    // Set up minimal environment
    process.env.NODE_ENV = 'test';
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.DISCORD_GUILD_ID = 'test-guild';
    
    const serviceManager = new ServiceManager();
    await serviceManager.initializeAll();

    // Get the report service instance through service manager (like manual command does)
    const reportServiceViaManager = await serviceManager.getService('report');
    
    // Get the discord service and check its report dependency (like scheduled task does)
    const discordService = await serviceManager.getService('discord');
    const reportServiceViaDependency = discordService.report;

    console.log('📊 Service Instance Comparison:');
    console.log(`Report via ServiceManager: ${reportServiceViaManager.constructor.name}`);
    console.log(`Report via Discord dependency: ${reportServiceViaDependency.constructor.name}`);
    console.log(`Same instance? ${reportServiceViaManager === reportServiceViaDependency}`);

    // Test cache access from both
    console.log('\n📦 Cache Access Test:');
    
    // Get today's cache key
    const today = new Date().toISOString().split('T')[0];
    const cacheKeyToday = `summaries_${today}`;
    const cacheKeyYesterday = `summaries_${new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0]}`;
    
    console.log(`Testing cache keys: ${cacheKeyToday}, ${cacheKeyYesterday}`);
    
    // Test cache service access through both report services
    const cacheServiceViaManager = reportServiceViaManager.cache;
    const cacheServiceViaDependency = reportServiceViaDependency.cache;
    
    console.log(`Cache via Manager: ${cacheServiceViaManager?.constructor.name || 'undefined'}`);
    console.log(`Cache via Dependency: ${cacheServiceViaDependency?.constructor.name || 'undefined'}`);
    console.log(`Same cache instance? ${cacheServiceViaManager === cacheServiceViaDependency}`);

    // Test database access
    console.log('\n🗄️ Database Access Test:');
    const dbServiceViaManager = reportServiceViaManager.database;
    const dbServiceViaDependency = reportServiceViaDependency.database;
    
    console.log(`Database via Manager: ${dbServiceViaManager?.constructor.name || 'undefined'}`);
    console.log(`Database via Dependency: ${dbServiceViaDependency?.constructor.name || 'undefined'}`);
    console.log(`Same database instance? ${dbServiceViaManager === dbServiceViaDependency}`);

    // Test the actual getRecentSummaries method from both
    console.log('\n🔍 Testing getRecentSummaries from both instances:');
    
    try {
      const summariesViaManager = await reportServiceViaManager.getRecentSummaries();
      console.log(`Manager instance found: ${summariesViaManager.length} summaries`);
    } catch (error) {
      console.log(`Manager instance error: ${error.message}`);
    }
    
    try {
      const summariesViaDependency = await reportServiceViaDependency.getRecentSummaries();
      console.log(`Dependency instance found: ${summariesViaDependency.length} summaries`);
    } catch (error) {
      console.log(`Dependency instance error: ${error.message}`);
    }

    // Test direct database query from both
    if (dbServiceViaManager && dbServiceViaDependency) {
      console.log('\n📋 Testing direct database queries:');
      
      try {
        const dbResultsManager = await dbServiceViaManager.getRecentSummaries(24);
        console.log(`Database via Manager: ${dbResultsManager.length} summaries`);
      } catch (error) {
        console.log(`Database via Manager error: ${error.message}`);
      }
      
      try {
        const dbResultsDependency = await dbServiceViaDependency.getRecentSummaries(24);
        console.log(`Database via Dependency: ${dbResultsDependency.length} summaries`);
      } catch (error) {
        console.log(`Database via Dependency error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Comparison error:', error.message);
  }
}

compareServiceInstances();